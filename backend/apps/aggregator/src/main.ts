import { QUEUES } from "@video-streaming/contracts";
import { createPrismaClient, PrismaIdempotencyStore } from "@video-streaming/database";
import { assertTopology, connectRabbitMQ, EventConsumer, EventPublisher, getRetrySpec } from "@video-streaming/messaging";
import { createS3Client, StorageClient } from "@video-streaming/storage";
import type { ChunkTranscoded } from "@video-streaming/contracts";
import { loadConfig } from "./config";
import { handleChunkTranscoded } from "./handler";

async function main(): Promise<void> {
  const config = loadConfig();

  const prisma = createPrismaClient({ datasources: { db: { url: config.databaseUrl } } });
  const rabbit = await connectRabbitMQ(config.rabbitmqUrl);
  await assertTopology(rabbit.channel);

  const s3 = createS3Client(config.storage);
  const hlsStorage = new StorageClient(s3, config.storage.hlsBucket);
  const publisher = new EventPublisher(rabbit.channel);
  const idempotency = new PrismaIdempotencyStore(prisma, "aggregator");
  const consumer = new EventConsumer(rabbit.channel, idempotency);
  const spec = getRetrySpec(QUEUES.aggregator);

  await consumer.start(
    {
      queue: QUEUES.aggregator,
      retryExchange: spec.exchange,
      retryRoutingKey: spec.retryRoutingKey,
      dlqExchange: spec.exchange,
      dlqRoutingKey: spec.deadRoutingKey,
      maxAttempts: config.maxAttempts,
      prefetch: 5,
    },
    (event) =>
      handleChunkTranscoded(event as ChunkTranscoded, {
        db: prisma,
        publisher,
        putObject: (key, body) => hlsStorage.putObject(key, body, "application/vnd.apple.mpegurl"),
      }),
  );

  console.log("aggregator listening on", QUEUES.aggregator);
}

main().catch((error) => {
  console.error("aggregator failed to start", error);
  process.exit(1);
});
