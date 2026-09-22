import type { Channel, Options } from "amqplib";
import { context, propagation } from "@opentelemetry/api";

export type PublishChannel = Pick<Channel, "publish">;

export interface PublishOptions {
  persistent?: boolean;
  headers?: Record<string, unknown>;
}

export class EventPublisher {
  constructor(private readonly channel: PublishChannel) {}

  publish(exchange: string, routingKey: string, event: unknown, options: PublishOptions = {}): void {
    const content = Buffer.from(JSON.stringify(event));
    const headers: Record<string, unknown> = { ...options.headers };
    // Carries the current trace context across the process boundary so a
    // consumer elsewhere can continue the same trace (see Fase 8).
    propagation.inject(context.active(), headers);

    const publishOptions: Options.Publish = {
      persistent: options.persistent ?? true,
      contentType: "application/json",
      headers,
    };
    const ok = this.channel.publish(exchange, routingKey, content, publishOptions);
    if (!ok) {
      throw new Error(`Failed to publish to ${exchange}/${routingKey}: channel write buffer full`);
    }
  }
}
