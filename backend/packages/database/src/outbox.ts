import type { Prisma, PrismaClient } from "@prisma/client";

export type DbClient = PrismaClient | Prisma.TransactionClient;

export interface EnqueueOutboxInput {
  exchange: string;
  routingKey: string;
  payload: unknown;
}

export class OutboxRepository {
  async enqueue(db: DbClient, input: EnqueueOutboxInput): Promise<void> {
    await db.outboxMessage.create({
      data: {
        exchange: input.exchange,
        routingKey: input.routingKey,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
  }

  async fetchUnpublished(db: DbClient, limit = 50) {
    return db.outboxMessage.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  async markPublished(db: DbClient, id: string): Promise<void> {
    await db.outboxMessage.update({
      where: { id },
      data: { publishedAt: new Date() },
    });
  }
}
