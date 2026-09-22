import type { Channel } from "amqplib";
import { BINDINGS, EXCHANGES, QUEUES, ROUTING_KEYS } from "@video-streaming/contracts";

export interface RetryableQueueSpec {
  exchange: string;
  mainQueue: string;
  mainRoutingKey: string;
  retryQueue: string;
  retryRoutingKey: string;
  dlq: string;
  deadRoutingKey: string;
}

export const STATUS_RETRY_ROUTING_KEY = "video.status.retry";
export const STATUS_DEAD_ROUTING_KEY = "video.status.dead";
export const TRANSCODE_RETRY_ROUTING_KEY = "transcode.requested.retry";
export const TRANSCODE_DEAD_ROUTING_KEY = "transcode.requested.dead";

// Every consumer queue gets its own retry queue (TTL + dead-letter back to the
// main exchange/routing key) and its own DLQ. upload-api.status.q is fed by
// several routing keys (video.ready, video.*.failed), so it uses a dedicated
// retry/dead routing key pair instead of deriving one from a single key -
// the consumer dispatches on the event's own `eventType` field, not on the
// AMQP routing key, so any routing key bound to that queue works here.
export const RETRYABLE_QUEUES: RetryableQueueSpec[] = [
  {
    exchange: EXCHANGES.videoEvents,
    mainQueue: QUEUES.validator,
    mainRoutingKey: ROUTING_KEYS.videoUploaded,
    retryQueue: QUEUES.validatorRetry,
    retryRoutingKey: `${ROUTING_KEYS.videoUploaded}.retry`,
    dlq: QUEUES.validatorDlq,
    deadRoutingKey: `${ROUTING_KEYS.videoUploaded}.dead`,
  },
  {
    exchange: EXCHANGES.videoEvents,
    mainQueue: QUEUES.dispatcher,
    mainRoutingKey: ROUTING_KEYS.videoValidated,
    retryQueue: QUEUES.dispatcherRetry,
    retryRoutingKey: `${ROUTING_KEYS.videoValidated}.retry`,
    dlq: QUEUES.dispatcherDlq,
    deadRoutingKey: `${ROUTING_KEYS.videoValidated}.dead`,
  },
  {
    exchange: EXCHANGES.videoEvents,
    mainQueue: QUEUES.aggregator,
    mainRoutingKey: ROUTING_KEYS.chunkTranscoded,
    retryQueue: QUEUES.aggregatorRetry,
    retryRoutingKey: `${ROUTING_KEYS.chunkTranscoded}.retry`,
    dlq: QUEUES.aggregatorDlq,
    deadRoutingKey: `${ROUTING_KEYS.chunkTranscoded}.dead`,
  },
  {
    exchange: EXCHANGES.videoEvents,
    mainQueue: QUEUES.uploadApiStatus,
    mainRoutingKey: ROUTING_KEYS.videoReady,
    retryQueue: QUEUES.uploadApiStatusRetry,
    retryRoutingKey: STATUS_RETRY_ROUTING_KEY,
    dlq: QUEUES.uploadApiStatusDlq,
    deadRoutingKey: STATUS_DEAD_ROUTING_KEY,
  },
  {
    exchange: EXCHANGES.transcodeJobs,
    mainQueue: QUEUES.transcode,
    mainRoutingKey: ROUTING_KEYS.transcodeRequested,
    retryQueue: QUEUES.transcodeRetry,
    retryRoutingKey: TRANSCODE_RETRY_ROUTING_KEY,
    dlq: QUEUES.transcodeDlq,
    deadRoutingKey: TRANSCODE_DEAD_ROUTING_KEY,
  },
];

export function getRetrySpec(mainQueue: string): RetryableQueueSpec {
  const spec = RETRYABLE_QUEUES.find((entry) => entry.mainQueue === mainQueue);
  if (!spec) {
    throw new Error(`No retry/DLQ topology registered for queue ${mainQueue}`);
  }
  return spec;
}

export interface TopologyOptions {
  retryTtlMs?: number;
}

export async function assertTopology(channel: Channel, options: TopologyOptions = {}): Promise<void> {
  const retryTtlMs = options.retryTtlMs ?? 5_000;

  await channel.assertExchange(EXCHANGES.videoEvents, "topic", { durable: true });
  await channel.assertExchange(EXCHANGES.transcodeJobs, "direct", { durable: true });

  for (const binding of BINDINGS) {
    await channel.assertQueue(binding.queue, { durable: true });
    await channel.bindQueue(binding.queue, binding.exchange, binding.routingKey);
  }

  for (const spec of RETRYABLE_QUEUES) {
    await channel.assertQueue(spec.retryQueue, {
      durable: true,
      arguments: {
        "x-message-ttl": retryTtlMs,
        "x-dead-letter-exchange": spec.exchange,
        "x-dead-letter-routing-key": spec.mainRoutingKey,
      },
    });
    await channel.bindQueue(spec.retryQueue, spec.exchange, spec.retryRoutingKey);

    await channel.assertQueue(spec.dlq, { durable: true });
    await channel.bindQueue(spec.dlq, spec.exchange, spec.deadRoutingKey);
  }
}
