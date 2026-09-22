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
import type { VideoUploaded } from "@video-streaming/contracts";
import { loadConfig } from "./config";
import { probeVideo } from "./ffprobe";
import { handleVideoUploaded } from "./handler";

const SERVICE_NAME = "validator";

async function main(): Promise<void> {
  const config = loadConfig();
  initTracing({ serviceName: SERVICE_NAME, otlpEndpoint: config.otlpEndpoint });

  const metrics = new MetricsRegistry();
  await startMetricsServer(metrics, config.metricsPort);

  const prisma = createPrismaClient({ datasources: { db: { url: config.databaseUrl } } });
  const s3 = createS3Client(config.storage);
  const storage = new StorageClient(s3, config.storage.rawBucket);

  // Re-asserts topology and rebuilds the consumer against the new channel
  // every time RabbitMQ drops and comes back - this is what lets the
  // service survive the "derrubar Rabbit" chaos drill (Fase 9).
  const onReady = async (rabbit: RabbitConnection): Promise<void> => {
    await assertTopology(rabbit.channel);
    startQueueDepthPoller(
      rabbit.channel,
      [QUEUES.validator, QUEUES.validatorRetry, QUEUES.validatorDlq],
      (queue, depth) => metrics.setQueueDepth(queue, depth),
      config.queueDepthPollMs,
    );

    const publisher = new EventPublisher(rabbit.channel);
    const idempotency = new PrismaIdempotencyStore(prisma, "validator");
    const consumer = new EventConsumer(rabbit.channel, idempotency, { serviceName: SERVICE_NAME, metrics });
    const spec = getRetrySpec(QUEUES.validator);

    await consumer.start(
      {
        queue: QUEUES.validator,
        retryExchange: spec.exchange,
        retryRoutingKey: spec.retryRoutingKey,
        dlqExchange: spec.exchange,
        dlqRoutingKey: spec.deadRoutingKey,
        maxAttempts: config.maxAttempts,
        prefetch: 5,
      },
      (event) =>
        handleVideoUploaded(event as VideoUploaded, {
          publisher,
          probe: (url) => probeVideo(url, config.ffprobePath),
          presignGet: (key) => storage.presignGetObject(key),
        }),
    );

    console.log("validator listening on", QUEUES.validator);
  };

  await connectWithRetry({
    url: config.rabbitmqUrl,
    onReady,
    onReconnecting: (attempt, delayMs, error) =>
      console.error(`validator: rabbitmq connect attempt ${attempt} failed, retrying in ${delayMs}ms`, error),
  });
}

main().catch((error) => {
  console.error("validator failed to start", error);
  process.exit(1);
});
