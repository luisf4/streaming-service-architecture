import type { Channel } from "amqplib";

export type QueueDepthChannel = Pick<Channel, "checkQueue">;

export interface QueueDepthPollerHandle {
  stop: () => void;
}

/**
 * Polls `channel.checkQueue` for each queue's ready-message count and hands
 * it to `onDepth` - the "profundidade das filas" metric from Fase 8. Errors
 * checking one queue (e.g. it doesn't exist yet) don't stop polling the
 * others or future ticks.
 */
export function startQueueDepthPoller(
  channel: QueueDepthChannel,
  queues: string[],
  onDepth: (queue: string, depth: number) => void,
  intervalMs: number,
): QueueDepthPollerHandle {
  const timer = setInterval(() => {
    for (const queue of queues) {
      channel
        .checkQueue(queue)
        .then((result) => onDepth(queue, result.messageCount))
        .catch(() => {
          // Queue not asserted yet or broker hiccup - skip this tick for it.
        });
    }
  }, intervalMs);

  return { stop: () => clearInterval(timer) };
}
