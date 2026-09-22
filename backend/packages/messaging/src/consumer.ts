import type { Channel, ConsumeMessage } from "amqplib";
import { context, propagation } from "@opentelemetry/api";
import type { IdempotencyStore } from "./idempotency";
import { decideRetry, FAILURE_REASON_HEADER, nextAttemptHeaders } from "./retry";

export type ConsumerChannel = Pick<Channel, "consume" | "cancel" | "ack" | "nack" | "publish" | "prefetch">;

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

export interface MetricsRecorder {
  recordJob(service: string, outcome: "success" | "retry" | "dead-letter", durationSeconds?: number): void;
}

export interface ObservabilityOptions {
  serviceName?: string;
  metrics?: MetricsRecorder;
}

function extractHeadersContext(headers: ConsumeMessage["properties"]["headers"]) {
  const carrier: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (typeof value === "string") carrier[key] = value;
  }
  return propagation.extract(context.active(), carrier);
}

export class EventConsumer {
  private consumerTag?: string;
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly channel: ConsumerChannel,
    private readonly idempotency: IdempotencyStore,
    private readonly observability: ObservabilityOptions = {},
  ) {}

  async start(options: ConsumerOptions, handler: EventHandler): Promise<void> {
    if (options.prefetch) {
      await this.channel.prefetch(options.prefetch);
    }
    const reply = await this.channel.consume(options.queue, (msg) => {
      if (!msg) return;
      const task = this.handleMessage(msg, options, handler).finally(() => {
        this.inFlight.delete(task);
      });
      this.inFlight.add(task);
    });
    this.consumerTag = reply.consumerTag;
  }

  /**
   * Stops accepting new deliveries and waits for every in-flight handler to
   * finish before resolving - so a worker can be killed without abandoning
   * a job partway through.
   */
  async stop(): Promise<void> {
    if (this.consumerTag) {
      await this.channel.cancel(this.consumerTag);
    }
    await Promise.allSettled([...this.inFlight]);
  }

  async handleMessage(msg: ConsumeMessage, options: ConsumerOptions, handler: EventHandler): Promise<void> {
    // Runs the handler inside the trace context carried in the message's
    // headers, so any span it opens is a child of the publisher's span
    // (upload-api -> validator -> dispatcher -> ... in the same trace).
    const parentContext = extractHeadersContext(msg.properties.headers);
    await context.with(parentContext, () => this.process(msg, options, handler));
  }

  private async process(msg: ConsumeMessage, options: ConsumerOptions, handler: EventHandler): Promise<void> {
    const event = JSON.parse(msg.content.toString()) as { eventId?: string };
    const eventId = event.eventId;

    if (eventId && (await this.idempotency.hasProcessed(eventId))) {
      this.channel.ack(msg);
      return;
    }

    const startedAt = process.hrtime.bigint();
    try {
      await handler(event, msg);
      if (eventId) {
        await this.idempotency.markProcessed(eventId);
      }
      this.channel.ack(msg);
      this.recordOutcome("success", startedAt);
    } catch (error) {
      const outcome = this.handleFailure(msg, options, error);
      this.recordOutcome(outcome, startedAt);
    }
  }

  private recordOutcome(outcome: "success" | "retry" | "dead-letter", startedAt: bigint): void {
    if (!this.observability.metrics || !this.observability.serviceName) return;
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    this.observability.metrics.recordJob(this.observability.serviceName, outcome, durationSeconds);
  }

  private handleFailure(msg: ConsumeMessage, options: ConsumerOptions, error: unknown): "retry" | "dead-letter" {
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
    return decision.action;
  }
}
