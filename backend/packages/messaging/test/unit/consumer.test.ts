import { describe, expect, it, vi } from "vitest";
import type { ConsumeMessage } from "amqplib";
import { EventConsumer, type ConsumerOptions } from "../../src/consumer";
import { InMemoryIdempotencyStore } from "../../src/idempotency";
import { ATTEMPT_HEADER, FAILURE_REASON_HEADER } from "../../src/retry";

function fakeMessage(body: unknown, headers: Record<string, unknown> = {}): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(body)),
    fields: {
      deliveryTag: 1,
      redelivered: false,
      exchange: "video.events",
      routingKey: "video.uploaded",
    } as ConsumeMessage["fields"],
    properties: { headers } as ConsumeMessage["properties"],
  };
}

function options(overrides: Partial<ConsumerOptions> = {}): ConsumerOptions {
  return {
    queue: "validator.q",
    retryExchange: "transcode.jobs",
    retryRoutingKey: "transcode.retry",
    dlqExchange: "transcode.jobs",
    dlqRoutingKey: "transcode.dead",
    maxAttempts: 3,
    ...overrides,
  };
}

function fakeChannel() {
  return {
    consume: vi.fn().mockResolvedValue({ consumerTag: "tag-1" }),
    cancel: vi.fn().mockResolvedValue(undefined),
    ack: vi.fn(),
    nack: vi.fn(),
    publish: vi.fn().mockReturnValue(true),
    prefetch: vi.fn(),
  };
}

describe("EventConsumer.handleMessage", () => {
  it("acks and marks the event processed on success", async () => {
    const channel = fakeChannel();
    const idempotency = new InMemoryIdempotencyStore();
    const consumer = new EventConsumer(channel, idempotency);
    const handler = vi.fn().mockResolvedValue(undefined);
    const msg = fakeMessage({ eventId: "evt-1" });

    await consumer.handleMessage(msg, options(), handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(await idempotency.hasProcessed("evt-1")).toBe(true);
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it("skips the handler and acks when the event was already processed", async () => {
    const channel = fakeChannel();
    const idempotency = new InMemoryIdempotencyStore();
    await idempotency.markProcessed("evt-1");
    const consumer = new EventConsumer(channel, idempotency);
    const handler = vi.fn().mockResolvedValue(undefined);
    const msg = fakeMessage({ eventId: "evt-1" });

    await consumer.handleMessage(msg, options(), handler);

    expect(handler).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(msg);
  });

  it("republishes to the retry exchange with an incremented attempt when under maxAttempts", async () => {
    const channel = fakeChannel();
    const consumer = new EventConsumer(channel, new InMemoryIdempotencyStore());
    const handler = vi.fn().mockRejectedValue(new Error("boom"));
    const msg = fakeMessage({ eventId: "evt-1" }, { [ATTEMPT_HEADER]: 0 });

    await consumer.handleMessage(msg, options({ maxAttempts: 3 }), handler);

    expect(channel.publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, content, publishOptions] = channel.publish.mock.calls[0];
    expect(exchange).toBe("transcode.jobs");
    expect(routingKey).toBe("transcode.retry");
    expect(content).toBe(msg.content);
    expect(publishOptions.headers[ATTEMPT_HEADER]).toBe(1);
    expect(channel.ack).toHaveBeenCalledWith(msg);
  });

  it("sends to the DLQ with the failure reason once maxAttempts is reached", async () => {
    const channel = fakeChannel();
    const consumer = new EventConsumer(channel, new InMemoryIdempotencyStore());
    const handler = vi.fn().mockRejectedValue(new Error("boom"));
    const msg = fakeMessage({ eventId: "evt-1" }, { [ATTEMPT_HEADER]: 2 });

    await consumer.handleMessage(msg, options({ maxAttempts: 3 }), handler);

    expect(channel.publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, , publishOptions] = channel.publish.mock.calls[0];
    expect(exchange).toBe("transcode.jobs");
    expect(routingKey).toBe("transcode.dead");
    expect(publishOptions.headers[FAILURE_REASON_HEADER]).toBe("boom");
    expect(channel.ack).toHaveBeenCalledWith(msg);
  });

  it("does not mark the event processed when the handler fails", async () => {
    const channel = fakeChannel();
    const idempotency = new InMemoryIdempotencyStore();
    const consumer = new EventConsumer(channel, idempotency);
    const handler = vi.fn().mockRejectedValue(new Error("boom"));
    const msg = fakeMessage({ eventId: "evt-1" });

    await consumer.handleMessage(msg, options(), handler);

    expect(await idempotency.hasProcessed("evt-1")).toBe(false);
  });
});

describe("EventConsumer graceful shutdown", () => {
  it("stop() cancels the consumer tag and waits for in-flight handlers to finish", async () => {
    const channel = fakeChannel();
    let deliverMessage!: (msg: ConsumeMessage) => void;
    channel.consume.mockImplementation(async (_queue: string, onMessage: (msg: ConsumeMessage) => void) => {
      deliverMessage = onMessage;
      return { consumerTag: "tag-1" };
    });

    const consumer = new EventConsumer(channel, new InMemoryIdempotencyStore());
    let resolveHandler!: () => void;
    const handler = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveHandler = resolve;
      }),
    );

    await consumer.start(options(), handler);
    deliverMessage(fakeMessage({ eventId: "evt-1" }));

    let stopped = false;
    const stopPromise = consumer.stop().then(() => {
      stopped = true;
    });

    expect(channel.cancel).toHaveBeenCalledWith("tag-1");
    // the in-flight handler hasn't resolved yet, so stop() must still be pending
    await Promise.resolve();
    expect(stopped).toBe(false);

    resolveHandler();
    await stopPromise;
    expect(stopped).toBe(true);
    expect(channel.ack).toHaveBeenCalled();
  });

  it("stop() resolves immediately when there is nothing in flight", async () => {
    const channel = fakeChannel();
    const consumer = new EventConsumer(channel, new InMemoryIdempotencyStore());

    await consumer.start(options(), vi.fn());
    await consumer.stop();

    expect(channel.cancel).toHaveBeenCalledWith("tag-1");
  });
});
