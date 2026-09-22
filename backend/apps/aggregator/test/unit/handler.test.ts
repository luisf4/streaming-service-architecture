import { randomUUID } from "node:crypto";
import type { ChunkTranscoded } from "@video-streaming/contracts";
import type { PrismaClient } from "@video-streaming/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { handleChunkTranscoded, manifestKey, resolutionPlaylistKey } from "../../src/handler";

function transcodedEvent(overrides: Partial<ChunkTranscoded["data"]> = {}): ChunkTranscoded {
  return {
    eventId: randomUUID(),
    eventType: "chunk.transcoded",
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    correlationId: randomUUID(),
    data: {
      videoId: randomUUID(),
      chunkId: randomUUID(),
      sequence: 0,
      resolution: "360p",
      segmentKey: "videos/v1/360p/segment-00000.ts",
      segmentDurationSec: 2,
      ...overrides,
    },
  };
}

describe("handleChunkTranscoded", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let publish: ReturnType<typeof vi.fn>;
  let putObject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    mockReset(prisma);
    publish = vi.fn();
    putObject = vi.fn().mockResolvedValue(undefined);
  });

  it("only records the rendition when the resolution is not fully transcoded yet", async () => {
    prisma.chunk.count.mockResolvedValue(3);
    prisma.rendition.count.mockResolvedValue(2); // this one plus one more already in, still short of 3

    const event = transcodedEvent();
    await handleChunkTranscoded(event, { db: prisma, publisher: { publish }, putObject });

    expect(prisma.rendition.create).toHaveBeenCalledWith({
      data: {
        videoId: event.data.videoId,
        chunkId: event.data.chunkId,
        resolution: "360p",
        segmentKey: event.data.segmentKey,
        sequence: 0,
        segmentDuration: 2,
      },
    });
    expect(putObject).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("builds and uploads the resolution playlist once all its chunks arrive, but waits for other resolutions", async () => {
    const videoId = randomUUID();
    prisma.chunk.count.mockResolvedValue(2);
    prisma.rendition.count.mockResolvedValue(2); // this resolution: complete
    prisma.rendition.findMany.mockResolvedValue([
      { sequence: 0, segmentDuration: 2, segmentKey: "videos/v1/360p/segment-00000.ts" },
      { sequence: 1, segmentDuration: 2, segmentKey: "videos/v1/360p/segment-00001.ts" },
    ] as never);
    prisma.transcodeJob.findMany.mockResolvedValue([
      { resolution: "360p" },
      { resolution: "720p" },
    ] as never);
    // second call (for the 720p check) reports it's not done yet
    prisma.rendition.count
      .mockResolvedValueOnce(2) // 360p, itself
      .mockResolvedValueOnce(2) // 360p, re-checked while scanning all resolutions
      .mockResolvedValueOnce(1); // 720p, not complete

    const event = transcodedEvent({ videoId, resolution: "360p" });
    await handleChunkTranscoded(event, { db: prisma, publisher: { publish }, putObject });

    expect(putObject).toHaveBeenCalledWith(
      resolutionPlaylistKey(videoId, "360p"),
      expect.stringContaining("#EXTM3U"),
    );
    expect(putObject).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes video.ready with the master playlist once every resolution is complete", async () => {
    const videoId = randomUUID();
    prisma.chunk.count.mockResolvedValue(2);
    prisma.rendition.findMany.mockResolvedValue([
      { sequence: 0, segmentDuration: 2, segmentKey: "videos/v1/720p/segment-00000.ts" },
      { sequence: 1, segmentDuration: 2, segmentKey: "videos/v1/720p/segment-00001.ts" },
    ] as never);
    prisma.transcodeJob.findMany.mockResolvedValue([
      { resolution: "360p" },
      { resolution: "720p" },
    ] as never);
    prisma.rendition.count.mockResolvedValue(2); // every resolution fully done

    const event = transcodedEvent({ videoId, resolution: "720p", sequence: 1 });
    await handleChunkTranscoded(event, { db: prisma, publisher: { publish }, putObject });

    expect(putObject).toHaveBeenCalledWith(resolutionPlaylistKey(videoId, "720p"), expect.any(String));
    expect(putObject).toHaveBeenCalledWith(manifestKey(videoId), expect.stringContaining("#EXT-X-STREAM-INF"));

    expect(publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, payload] = publish.mock.calls[0];
    expect(exchange).toBe("video.events");
    expect(routingKey).toBe("video.ready");
    expect(payload).toMatchObject({
      eventType: "video.ready",
      correlationId: event.correlationId,
      data: { videoId, manifestKey: manifestKey(videoId) },
    });

    // Status writes belong to upload-api alone (see the status ownership
    // table in PLAN.md) - the aggregator must never touch Video.status.
    expect(prisma.video.update).not.toHaveBeenCalled();
  });
});
