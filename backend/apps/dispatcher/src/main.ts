import { QUEUES } from "@video-streaming/contracts";
import { createPrismaClient, PrismaIdempotencyStore } from "@video-streaming/database";
import { assertTopology, connectRabbitMQ, EventConsumer, EventPublisher, getRetrySpec } from "@video-streaming/messaging";
import { createS3Client, StorageClient } from "@video-streaming/storage";
import type { VideoValidated } from "@video-streaming/contracts";
import { loadConfig } from "./config";
import { handleVideoValidated } from "./handler";
import { getKeyframeTimestamps } from "./keyframes";

async function main(): Promise<void> {
  const config = loadConfig();

  const prisma = createPrismaClient({ datasources: { db: { url: config.databaseUrl } } });
  const rabbit = await connectRabbitMQ(config.rabbitmqUrl);
  await assertTopology(rabbit.channel);

  const s3 = createS3Client(config.storage);
  const storage = new StorageClient(s3, config.storage.rawBucket);
  const publisher = new EventPublisher(rabbit.channel);
  const idempotency = new PrismaIdempotencyStore(prisma, "dispatcher");
  const consumer = new EventConsumer(rabbit.channel, idempotency);
  const spec = getRetrySpec(QUEUES.dispatcher);

  await consumer.start(
    {
      queue: QUEUES.dispatcher,
      retryExchange: spec.exchange,
      retryRoutingKey: spec.retryRoutingKey,
      dlqExchange: spec.exchange,
      dlqRoutingKey: spec.deadRoutingKey,
      maxAttempts: config.maxAttempts,
      prefetch: 5,
    },
    (event) =>
      handleVideoValidated(event as VideoValidated, {
        db: prisma,
        publisher,
        getKeyframes: (url) => getKeyframeTimestamps(url, config.ffprobePath),
        presignGet: (key) => storage.presignGetObject(key),
      }),
  );

  console.log("dispatcher listening on", QUEUES.dispatcher);
}

main().catch((error) => {
  console.error("dispatcher failed to start", error);
  process.exit(1);
});
