import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { PrismaIdempotencyStore } from "../../src/idempotency";

describe("PrismaIdempotencyStore", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let store: PrismaIdempotencyStore;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    mockReset(prisma);
    store = new PrismaIdempotencyStore(prisma, "video.uploaded");
  });

  it("reports not processed when no row exists", async () => {
    prisma.processedEvent.findUnique.mockResolvedValue(null);
    const eventId = randomUUID();

    expect(await store.hasProcessed(eventId)).toBe(false);
    expect(prisma.processedEvent.findUnique).toHaveBeenCalledWith({ where: { eventId } });
  });

  it("reports processed when a row exists", async () => {
    const eventId = randomUUID();
    prisma.processedEvent.findUnique.mockResolvedValue({
      eventId,
      eventType: "video.uploaded",
      processedAt: new Date(),
    });

    expect(await store.hasProcessed(eventId)).toBe(true);
  });

  it("upserts on markProcessed so replays never throw a unique-constraint error", async () => {
    const eventId = randomUUID();

    await store.markProcessed(eventId);

    expect(prisma.processedEvent.upsert).toHaveBeenCalledWith({
      where: { eventId },
      create: { eventId, eventType: "video.uploaded" },
      update: {},
    });
  });
});
