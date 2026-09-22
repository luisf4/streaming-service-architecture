import type { PrismaClient } from "@prisma/client";
import type { IdempotencyStore } from "@video-streaming/messaging";

export class PrismaIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly eventType: string,
  ) {}

  async hasProcessed(eventId: string): Promise<boolean> {
    const found = await this.prisma.processedEvent.findUnique({ where: { eventId } });
    return found !== null;
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.prisma.processedEvent.upsert({
      where: { eventId },
      create: { eventId, eventType: this.eventType },
      update: {},
    });
  }
}
