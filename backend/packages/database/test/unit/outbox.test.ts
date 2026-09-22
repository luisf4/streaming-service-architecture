import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { OutboxRepository } from "../../src/outbox";

describe("OutboxRepository", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let repository: OutboxRepository;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    mockReset(prisma);
    repository = new OutboxRepository();
  });

  it("creates an outbox row with the exchange, routing key and payload", async () => {
    await repository.enqueue(prisma, {
      exchange: "video.events",
      routingKey: "video.uploaded",
      payload: { videoId: "v1" },
    });

    expect(prisma.outboxMessage.create).toHaveBeenCalledWith({
      data: {
        exchange: "video.events",
        routingKey: "video.uploaded",
        payload: { videoId: "v1" },
      },
    });
  });

  it("fetches only unpublished rows, oldest first", async () => {
    prisma.outboxMessage.findMany.mockResolvedValue([]);

    await repository.fetchUnpublished(prisma, 10);

    expect(prisma.outboxMessage.findMany).toHaveBeenCalledWith({
      where: { publishedAt: null },
      orderBy: { createdAt: "asc" },
      take: 10,
    });
  });

  it("marks a row published by id", async () => {
    const id = randomUUID();

    await repository.markPublished(prisma, id);

    expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
      where: { id },
      data: { publishedAt: expect.any(Date) },
    });
  });
});
