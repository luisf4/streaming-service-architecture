import type { Channel } from "amqplib";
import { BINDINGS, EXCHANGES, QUEUES } from "@video-streaming/contracts";

export const TRANSCODE_RETRY_ROUTING_KEY = "transcode.retry";
export const TRANSCODE_DEAD_ROUTING_KEY = "transcode.dead";

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

  await channel.assertQueue(QUEUES.transcodeRetry, {
    durable: true,
    arguments: {
      "x-message-ttl": retryTtlMs,
      "x-dead-letter-exchange": EXCHANGES.transcodeJobs,
      "x-dead-letter-routing-key": "transcode.requested",
    },
  });
  await channel.bindQueue(QUEUES.transcodeRetry, EXCHANGES.transcodeJobs, TRANSCODE_RETRY_ROUTING_KEY);

  await channel.assertQueue(QUEUES.transcodeDlq, { durable: true });
  await channel.bindQueue(QUEUES.transcodeDlq, EXCHANGES.transcodeJobs, TRANSCODE_DEAD_ROUTING_KEY);
}
