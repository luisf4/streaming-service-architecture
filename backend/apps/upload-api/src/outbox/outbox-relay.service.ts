import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OutboxRepository, type PrismaClient } from "@video-streaming/database";
import type { EventPublisher } from "@video-streaming/messaging";
import type { AppConfig } from "../config/configuration";
import { EVENT_PUBLISHER, PRISMA_CLIENT } from "../tokens";

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private readonly outbox = new OutboxRepository();
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.config.get("outboxPollIntervalMs", { infer: true });
    this.timer = setInterval(() => {
      this.relayOnce().catch((error) => this.logger.error("outbox relay tick failed", error));
    }, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async relayOnce(): Promise<number> {
    const pending = await this.outbox.fetchUnpublished(this.prisma, 50);
    for (const message of pending) {
      this.publisher.publish(message.exchange, message.routingKey, message.payload);
      await this.outbox.markPublished(this.prisma, message.id);
    }
    return pending.length;
  }
}
