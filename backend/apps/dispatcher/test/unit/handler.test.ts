import { randomUUID } from "node:crypto";
import type { VideoValidated } from "@video-streaming/contracts";
import type { PrismaClient } from "@video-streaming/database";
import { describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { handleVideoValidated } from "../../src/handler";

function validatedEvent(durationSec = 5): VideoValidated {
  return {
    eventId: randomUUID(),
    eventType: "video.validated",
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    correlationId: randomUUID(),
    data: {
      videoId: randomUUID(),
      durationSec,
      format: "mov",
      storageKey: "videos/v1/original",
    },
  };
}

describe("handleVideoValidated", () => {
  it("plans keyframe-aligned chunks and publishes one transcode.requested per (chunk, resolution)", async () => {
    const prisma = mockDeep<PrismaClient>();
    mockReset(prisma);
    prisma.chunk.create
      .mockResolvedValueOnce({ id: "chunk-0", sequence: 0, startSec: 0, durationSec: 2 } as never)
      .mockResolvedValueOnce({ id: "chunk-1", sequence: 1, startSec: 2, durationSec: 2 } as never);
    prisma.transcodeJob.create
      .mockResolvedValueOnce({ chunkId: "chunk-0", resolution: "360p" } as never)
      .mockResolvedValueOnce({ chunkId: "chunk-1", resolution: "360p" } as never);

    const event = validatedEvent(4);
    const publish = vi.fn();
    const presignGet = vi.fn().mockResolvedValue("https://example.test/presigned");
    const getKeyframes = vi.fn().mockResolvedValue([0, 2]);

    await handleVideoValidated(event, {
      db: prisma,
      publisher: { publish },
      getKeyframes,
      presignGet,
      targetChunkSec: 2,
      resolutions: ["360p"],
    });

    expect(presignGet).toHaveBeenCalledWith(event.data.storageKey);
    expect(getKeyframes).toHaveBeenCalledWith("https://example.test/presigned");
    expect(prisma.chunk.create).toHaveBeenCalledTimes(2);

    expect(publish).toHaveBeenCalledTimes(2);
    const [exchange, routingKey, firstJob] = publish.mock.calls[0];
    expect(exchange).toBe("transcode.jobs");
    expect(routingKey).toBe("transcode.requested");
    expect(firstJob).toMatchObject({
      eventType: "transcode.requested",
      correlationId: event.correlationId,
      data: {
        videoId: event.data.videoId,
        chunkId: "chunk-0",
        sequence: 0,
        resolution: "360p",
        sourceKey: event.data.storageKey,
        startSec: 0,
        durationSec: 2,
      },
    });
    const [, , secondJob] = publish.mock.calls[1];
    expect(secondJob.data).toMatchObject({ chunkId: "chunk-1", sequence: 1, startSec: 2, durationSec: 2 });
  });
});
