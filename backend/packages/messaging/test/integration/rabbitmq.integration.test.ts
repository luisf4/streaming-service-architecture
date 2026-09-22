import { randomUUID } from "node:crypto";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectRabbitMQ, type RabbitConnection } from "../../src/connection";
import { EventConsumer } from "../../src/consumer";
import { EventPublisher } from "../../src/publisher";
import { InMemoryIdempotencyStore } from "../../src/idempotency";
import { assertTopology, getRetrySpec } from "../../src/topology";
import { isDockerAvailable } from "../docker";
import { EXCHANGES, QUEUES, ROUTING_KEYS } from "@video-streaming/contracts";

const dockerAvailable = isDockerAvailable();

describe.skipIf(!dockerAvailable)("RabbitMQ integration (Testcontainers)", () => {
  let container: StartedTestContainer;
  let rabbit: RabbitConnection;

  beforeAll(async () => {
    container = await new GenericContainer("rabbitmq:3.13-management-alpine")
      .withExposedPorts(5672)
      .withWaitStrategy(Wait.forLogMessage("Server startup complete"))
      .start();

    const url = `amqp://guest:guest@${container.getHost()}:${container.getMappedPort(5672)}`;
    rabbit = await connectRabbitMQ(url);
    await assertTopology(rabbit.channel, { retryTtlMs: 500 });
  }, 120_000);

  afterAll(async () => {
    await rabbit?.close();
    await container?.stop();
  });

  it("does not process the same event twice (idempotency)", async () => {
    const publisher = new EventPublisher(rabbit.channel);
    const idempotency = new InMemoryIdempotencyStore();
    const consumer = new EventConsumer(rabbit.channel, idempotency);
    const spec = getRetrySpec(QUEUES.validator);

    const eventId = randomUUID();
    const event = {
      eventId,
      eventType: "video.uploaded",
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      data: { videoId: randomUUID(), storageKey: "raw/x.mp4", sizeBytes: 1, originalFilename: "x.mp4" },
    };

    let handledCount = 0;
    await consumer.start(
      {
        queue: QUEUES.validator,
        retryExchange: spec.exchange,
        retryRoutingKey: spec.retryRoutingKey,
        dlqExchange: spec.exchange,
        dlqRoutingKey: spec.deadRoutingKey,
        maxAttempts: 3,
        prefetch: 1,
      },
      async () => {
        handledCount += 1;
      },
    );

    publisher.publish(EXCHANGES.videoEvents, ROUTING_KEYS.videoUploaded, event);
    publisher.publish(EXCHANGES.videoEvents, ROUTING_KEYS.videoUploaded, event);

    await new Promise((resolve) => setTimeout(resolve, 1_000));

    expect(handledCount).toBe(1);
  });

  it("dead-letters a message after 3 failed attempts", async () => {
    const publisher = new EventPublisher(rabbit.channel);
    const consumer = new EventConsumer(rabbit.channel, new InMemoryIdempotencyStore());
    const spec = getRetrySpec(QUEUES.transcode);

    const eventId = randomUUID();
    const event = {
      eventId,
      eventType: "transcode.requested",
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      data: {},
    };

    await consumer.start(
      {
        queue: QUEUES.transcode,
        retryExchange: spec.exchange,
        retryRoutingKey: spec.retryRoutingKey,
        dlqExchange: spec.exchange,
        dlqRoutingKey: spec.deadRoutingKey,
        maxAttempts: 3,
        prefetch: 1,
      },
      async () => {
        throw new Error("always fails");
      },
    );

    publisher.publish(EXCHANGES.transcodeJobs, ROUTING_KEYS.transcodeRequested, event);

    await new Promise((resolve) => setTimeout(resolve, 3_000));

    const dlqMessage = await rabbit.channel.get(QUEUES.transcodeDlq, { noAck: true });
    expect(dlqMessage).not.toBe(false);
    if (dlqMessage) {
      const parsed = JSON.parse(dlqMessage.content.toString());
      expect(parsed.eventId).toBe(eventId);
    }
  }, 15_000);
});
