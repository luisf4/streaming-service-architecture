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
import type { ChunkTranscoded } from "@video-streaming/contracts";
import { loadConfig } from "./config";
import { handleChunkTranscoded } from "./handler";

const SERVICE_NAME = "aggregator";

async function main(): Promise<void> {
  const config = loadConfig();
  initTracing({ serviceName: SERVICE_NAME, otlpEndpoint: config.otlpEndpoint });

  const metrics = new MetricsRegistry();
  await startMetricsServer(metrics, config.metricsPort);

  const prisma = createPrismaClient({ datasources: { db: { url: config.databaseUrl } } });
  const s3 = createS3Client(config.storage);
  const hlsStorage = new StorageClient(s3, config.storage.hlsBucket);

  const onReady = async (rabbit: RabbitConnection): Promise<void> => {
    await assertTopology(rabbit.channel);
    startQueueDepthPoller(
      rabbit.channel,
      [QUEUES.aggregator, QUEUES.aggregatorRetry, QUEUES.aggregatorDlq],
      (queue, depth) => metrics.setQueueDepth(queue, depth),
      config.queueDepthPollMs,
    );

    const publisher = new EventPublisher(rabbit.channel);
    const idempotency = new PrismaIdempotencyStore(prisma, "aggregator");
    const consumer = new EventConsumer(rabbit.channel, idempotency, { serviceName: SERVICE_NAME, metrics });
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
  };

  await connectWithRetry({
    url: config.rabbitmqUrl,
    onReady,
    onReconnecting: (attempt, delayMs, error) =>
      console.error(`aggregator: rabbitmq connect attempt ${attempt} failed, retrying in ${delayMs}ms`, error),
  });
}

main().catch((error) => {
  console.error("aggregator failed to start", error);
  process.exit(1);
});
