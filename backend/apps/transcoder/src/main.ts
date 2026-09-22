import { QUEUES } from "@video-streaming/contracts";
import { createPrismaClient, PrismaIdempotencyStore } from "@video-streaming/database";
import { assertTopology, connectRabbitMQ, EventConsumer, EventPublisher, getRetrySpec } from "@video-streaming/messaging";
import { createS3Client, StorageClient } from "@video-streaming/storage";
import type { TranscodeRequested } from "@video-streaming/contracts";
import { loadConfig } from "./config";
import { handleTranscodeRequested } from "./handler";
import { transcodeChunk } from "./transcode";

async function main(): Promise<void> {
  const config = loadConfig();

  const prisma = createPrismaClient({ datasources: { db: { url: config.databaseUrl } } });
  const rabbit = await connectRabbitMQ(config.rabbitmqUrl);
  await assertTopology(rabbit.channel);

  const s3 = createS3Client(config.storage);
  const rawStorage = new StorageClient(s3, config.storage.rawBucket);
  const hlsStorage = new StorageClient(s3, config.storage.hlsBucket);
  const publisher = new EventPublisher(rabbit.channel);
  const idempotency = new PrismaIdempotencyStore(prisma, "transcoder");
  const consumer = new EventConsumer(rabbit.channel, idempotency);
  const spec = getRetrySpec(QUEUES.transcode);

  await consumer.start(
    {
      queue: QUEUES.transcode,
      retryExchange: spec.exchange,
      retryRoutingKey: spec.retryRoutingKey,
      dlqExchange: spec.exchange,
      dlqRoutingKey: spec.deadRoutingKey,
      maxAttempts: config.maxAttempts,
      prefetch: config.prefetch,
    },
    (event) =>
      handleTranscodeRequested(event as TranscodeRequested, {
        publisher,
        presignGet: (key) => rawStorage.presignGetObject(key),
        putObject: (key, body) => hlsStorage.putObject(key, body),
        transcode: (options) => transcodeChunk({ ...options, ffmpegPath: config.ffmpegPath }),
      }),
  );

  console.log("transcoder listening on", QUEUES.transcode);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`transcoder received ${signal}, finishing in-flight jobs before exit`);
    await consumer.stop();
    await rabbit.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("transcoder failed to start", error);
  process.exit(1);
});
