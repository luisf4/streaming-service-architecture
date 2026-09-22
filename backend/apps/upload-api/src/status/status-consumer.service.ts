import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaIdempotencyStore, VideoRepository, type PrismaClient } from "@video-streaming/database";
import { EXCHANGES, QUEUES } from "@video-streaming/contracts";
import { EventConsumer, STATUS_DEAD_ROUTING_KEY, STATUS_RETRY_ROUTING_KEY, type ConsumerChannel } from "@video-streaming/messaging";
import type { AppConfig } from "../config/configuration";
import { PRISMA_CLIENT, RABBIT_CHANNEL } from "../tokens";

interface StatusEvent {
  eventType: string;
  data: Record<string, unknown>;
}

@Injectable()
export class StatusConsumerService implements OnModuleInit {
  private readonly logger = new Logger(StatusConsumerService.name);
  private readonly videos = new VideoRepository();

  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(RABBIT_CHANNEL) private readonly channel: ConsumerChannel,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    const idempotency = new PrismaIdempotencyStore(this.prisma, "upload-api.status");
    const consumer = new EventConsumer(this.channel, idempotency);
    await consumer.start(
      {
        queue: QUEUES.uploadApiStatus,
        retryExchange: EXCHANGES.videoEvents,
        retryRoutingKey: STATUS_RETRY_ROUTING_KEY,
        dlqExchange: EXCHANGES.videoEvents,
        dlqRoutingKey: STATUS_DEAD_ROUTING_KEY,
        maxAttempts: this.config.get("maxAttempts", { infer: true }),
        prefetch: 10,
      },
      (event) => this.handleEvent(event as StatusEvent),
    );
  }

  async handleEvent(event: StatusEvent): Promise<void> {
    const videoId = event.data.videoId as string;

    switch (event.eventType) {
      case "video.ready":
        await this.videos.updateStatus(this.prisma, videoId, "READY", {
          manifestKey: event.data.manifestKey as string,
        });
        return;
      case "video.validation.failed":
      case "video.transcode.failed":
        await this.videos.updateStatus(this.prisma, videoId, "FAILED", {
          failureReason: (event.data.reason as string) ?? "unknown",
        });
        return;
      default:
        this.logger.warn(`ignoring unexpected event type on status queue: ${event.eventType}`);
    }
  }
}
