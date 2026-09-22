import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@video-streaming/database";
import type { EventPublisher } from "@video-streaming/messaging";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { OutboxRelayService } from "../../src/outbox/outbox-relay.service";

describe("OutboxRelayService.relayOnce", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let publisher: { publish: ReturnType<typeof vi.fn> };
  let service: OutboxRelayService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    mockReset(prisma);
    publisher = { publish: vi.fn() };
    service = new OutboxRelayService(prisma, publisher as unknown as EventPublisher, {} as never);
  });

  it("publishes every unpublished row and marks it published", async () => {
    const idA = randomUUID();
    const idB = randomUUID();
    prisma.outboxMessage.findMany.mockResolvedValue([
      { id: idA, exchange: "video.events", routingKey: "video.uploaded", payload: { a: 1 } },
      { id: idB, exchange: "video.events", routingKey: "video.ready", payload: { b: 2 } },
    ] as never);

    const count = await service.relayOnce();

    expect(count).toBe(2);
    expect(publisher.publish).toHaveBeenNthCalledWith(1, "video.events", "video.uploaded", { a: 1 });
    expect(publisher.publish).toHaveBeenNthCalledWith(2, "video.events", "video.ready", { b: 2 });
    expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
      where: { id: idA },
      data: { publishedAt: expect.any(Date) },
    });
    expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
      where: { id: idB },
      data: { publishedAt: expect.any(Date) },
    });
  });

  it("does nothing when there are no pending rows", async () => {
    prisma.outboxMessage.findMany.mockResolvedValue([]);

    const count = await service.relayOnce();

    expect(count).toBe(0);
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
