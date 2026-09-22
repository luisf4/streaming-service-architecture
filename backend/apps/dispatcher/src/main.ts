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
import type { VideoValidated } from "@video-streaming/contracts";
import { loadConfig } from "./config";
import { handleVideoValidated } from "./handler";
import { getKeyframeTimestamps } from "./keyframes";

const SERVICE_NAME = "dispatcher";

async function main(): Promise<void> {
  const config = loadConfig();
  initTracing({ serviceName: SERVICE_NAME, otlpEndpoint: config.otlpEndpoint });

  const metrics = new MetricsRegistry();
  await startMetricsServer(metrics, config.metricsPort);

  const prisma = createPrismaClient({ datasources: { db: { url: config.databaseUrl } } });
  const s3 = createS3Client(config.storage);
  const storage = new StorageClient(s3, config.storage.rawBucket);

  const onReady = async (rabbit: RabbitConnection): Promise<void> => {
    await assertTopology(rabbit.channel);
    startQueueDepthPoller(
      rabbit.channel,
      [QUEUES.dispatcher, QUEUES.dispatcherRetry, QUEUES.dispatcherDlq],
      (queue, depth) => metrics.setQueueDepth(queue, depth),
      config.queueDepthPollMs,
    );

    const publisher = new EventPublisher(rabbit.channel);
    const idempotency = new PrismaIdempotencyStore(prisma, "dispatcher");
    const consumer = new EventConsumer(rabbit.channel, idempotency, { serviceName: SERVICE_NAME, metrics });
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
  };

  await connectWithRetry({
    url: config.rabbitmqUrl,
    onReady,
    onReconnecting: (attempt, delayMs, error) =>
      console.error(`dispatcher: rabbitmq connect attempt ${attempt} failed, retrying in ${delayMs}ms`, error),
  });
}

main().catch((error) => {
  console.error("dispatcher failed to start", error);
  process.exit(1);
});
