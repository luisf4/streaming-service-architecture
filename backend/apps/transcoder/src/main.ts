import { QUEUES } from "@video-streaming/contracts";
import { createPrismaClient, PrismaIdempotencyStore } from "@video-streaming/database";
import {
  assertTopology,
  connectWithRetry,
  EventConsumer,
  EventPublisher,
  getRetrySpec,
  startQueueDepthPoller,
  type RabbitConnection,
} from "@video-streaming/messaging";
import { initTracing, MetricsRegistry, startMetricsServer } from "@video-streaming/observability";
import { createS3Client, StorageClient } from "@video-streaming/storage";
import type { TranscodeRequested } from "@video-streaming/contracts";
import { loadConfig } from "./config";
import { handleTranscodeRequested } from "./handler";
import { transcodeChunk } from "./transcode";

const SERVICE_NAME = "transcoder";

async function main(): Promise<void> {
  const config = loadConfig();
  initTracing({ serviceName: SERVICE_NAME, otlpEndpoint: config.otlpEndpoint });

  const metrics = new MetricsRegistry();
  await startMetricsServer(metrics, config.metricsPort);

  const prisma = createPrismaClient({ datasources: { db: { url: config.databaseUrl } } });
  const s3 = createS3Client(config.storage);
  const rawStorage = new StorageClient(s3, config.storage.rawBucket);
  const hlsStorage = new StorageClient(s3, config.storage.hlsBucket);

  let currentConsumer: EventConsumer | undefined;

  const onReady = async (rabbit: RabbitConnection): Promise<void> => {
    await assertTopology(rabbit.channel);
    startQueueDepthPoller(
      rabbit.channel,
      [QUEUES.transcode, QUEUES.transcodeRetry, QUEUES.transcodeDlq],
      (queue, depth) => metrics.setQueueDepth(queue, depth),
      config.queueDepthPollMs,
    );

    const publisher = new EventPublisher(rabbit.channel);
    const idempotency = new PrismaIdempotencyStore(prisma, "transcoder");
    const consumer = new EventConsumer(rabbit.channel, idempotency, { serviceName: SERVICE_NAME, metrics });
    currentConsumer = consumer;
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
  };

  const rabbitHandle = await connectWithRetry({
    url: config.rabbitmqUrl,
    onReady,
    onReconnecting: (attempt, delayMs, error) =>
      console.error(`transcoder: rabbitmq connect attempt ${attempt} failed, retrying in ${delayMs}ms`, error),
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`transcoder received ${signal}, finishing in-flight jobs before exit`);
    await currentConsumer?.stop();
    await rabbitHandle.close();
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
