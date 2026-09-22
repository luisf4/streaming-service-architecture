import type { Channel, ConsumeMessage } from "amqplib";
import type { IdempotencyStore } from "./idempotency";
import { decideRetry, FAILURE_REASON_HEADER, nextAttemptHeaders } from "./retry";

export type ConsumerChannel = Pick<Channel, "consume" | "ack" | "nack" | "publish" | "prefetch">;

export interface ConsumerOptions {
  queue: string;
  retryExchange: string;
  retryRoutingKey: string;
  dlqExchange: string;
  dlqRoutingKey: string;
  maxAttempts: number;
  prefetch?: number;
}

export type EventHandler = (event: unknown, msg: ConsumeMessage) => Promise<void>;

export class EventConsumer {
  constructor(
    private readonly channel: ConsumerChannel,
    private readonly idempotency: IdempotencyStore,
  ) {}

  async start(options: ConsumerOptions, handler: EventHandler): Promise<void> {
    if (options.prefetch) {
      await this.channel.prefetch(options.prefetch);
    }
    await this.channel.consume(options.queue, (msg) => {
      if (!msg) return;
      void this.handleMessage(msg, options, handler);
    });
  }

  async handleMessage(msg: ConsumeMessage, options: ConsumerOptions, handler: EventHandler): Promise<void> {
    const event = JSON.parse(msg.content.toString()) as { eventId?: string };
    const eventId = event.eventId;

    if (eventId && (await this.idempotency.hasProcessed(eventId))) {
      this.channel.ack(msg);
      return;
    }

    try {
      await handler(event, msg);
      if (eventId) {
        await this.idempotency.markProcessed(eventId);
      }
      this.channel.ack(msg);
    } catch (error) {
      this.handleFailure(msg, options, error);
    }
  }

  private handleFailure(msg: ConsumeMessage, options: ConsumerOptions, error: unknown): void {
    const decision = decideRetry(msg.properties.headers, options.maxAttempts);
    const headers = nextAttemptHeaders(msg.properties.headers);

    if (decision.action === "retry") {
      this.channel.publish(options.retryExchange, options.retryRoutingKey, msg.content, {
        persistent: true,
        headers,
      });
    } else {
      this.channel.publish(options.dlqExchange, options.dlqRoutingKey, msg.content, {
        persistent: true,
        headers: {
          ...headers,
          [FAILURE_REASON_HEADER]: error instanceof Error ? error.message : String(error),
        },
      });
    }
    this.channel.ack(msg);
  }
}
