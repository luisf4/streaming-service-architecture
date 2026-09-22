import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@video-streaming/database";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { persistChunksAndJobs } from "../../src/persist-chunks";

describe("persistChunksAndJobs", () => {
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    mockReset(prisma);
  });

  it("creates a chunk row per plan entry and a transcode job per (chunk, resolution) pair", async () => {
    const videoId = randomUUID();
    prisma.chunk.create
      .mockResolvedValueOnce({ id: "chunk-0", sequence: 0, startSec: 0, durationSec: 2 } as never)
      .mockResolvedValueOnce({ id: "chunk-1", sequence: 1, startSec: 2, durationSec: 3 } as never);
    prisma.transcodeJob.create
      .mockResolvedValueOnce({ chunkId: "chunk-0", resolution: "360p" } as never)
      .mockResolvedValueOnce({ chunkId: "chunk-0", resolution: "720p" } as never)
      .mockResolvedValueOnce({ chunkId: "chunk-1", resolution: "360p" } as never)
      .mockResolvedValueOnce({ chunkId: "chunk-1", resolution: "720p" } as never);

    const jobs = await persistChunksAndJobs(
      prisma,
      videoId,
      "videos/v1/original",
      [
        { sequence: 0, startSec: 0, durationSec: 2 },
        { sequence: 1, startSec: 2, durationSec: 3 },
      ],
      ["360p", "720p"],
    );

    expect(prisma.chunk.create).toHaveBeenCalledTimes(2);
    expect(prisma.chunk.create).toHaveBeenNthCalledWith(1, {
      data: { videoId, sequence: 0, startSec: 0, durationSec: 2, sourceKey: "videos/v1/original" },
    });
    expect(prisma.transcodeJob.create).toHaveBeenCalledTimes(4);
    expect(prisma.transcodeJob.create).toHaveBeenNthCalledWith(1, {
      data: { videoId, chunkId: "chunk-0", resolution: "360p" },
    });

    expect(jobs).toEqual([
      { chunkId: "chunk-0", sequence: 0, startSec: 0, durationSec: 2, resolution: "360p" },
      { chunkId: "chunk-0", sequence: 0, startSec: 0, durationSec: 2, resolution: "720p" },
      { chunkId: "chunk-1", sequence: 1, startSec: 2, durationSec: 3, resolution: "360p" },
      { chunkId: "chunk-1", sequence: 1, startSec: 2, durationSec: 3, resolution: "720p" },
    ]);
  });
});
