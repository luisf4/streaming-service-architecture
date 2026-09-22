import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { ChunkRepository } from "../../src/chunk-repository";

describe("ChunkRepository", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let repository: ChunkRepository;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    mockReset(prisma);
    repository = new ChunkRepository();
  });

  it("creates one row per input, in order", async () => {
    const videoId = randomUUID();
    prisma.chunk.create
      .mockResolvedValueOnce({ id: "c1" } as never)
      .mockResolvedValueOnce({ id: "c2" } as never);

    const result = await repository.createMany(prisma, [
      { videoId, sequence: 0, startSec: 0, durationSec: 2, sourceKey: "videos/v1/original" },
      { videoId, sequence: 1, startSec: 2, durationSec: 2, sourceKey: "videos/v1/original" },
    ]);

    expect(prisma.chunk.create).toHaveBeenNthCalledWith(1, {
      data: { videoId, sequence: 0, startSec: 0, durationSec: 2, sourceKey: "videos/v1/original" },
    });
    expect(prisma.chunk.create).toHaveBeenNthCalledWith(2, {
      data: { videoId, sequence: 1, startSec: 2, durationSec: 2, sourceKey: "videos/v1/original" },
    });
    expect(result).toEqual([{ id: "c1" }, { id: "c2" }]);
  });

  it("finds chunks for a video ordered by sequence", async () => {
    const videoId = randomUUID();

    await repository.findByVideoId(prisma, videoId);

    expect(prisma.chunk.findMany).toHaveBeenCalledWith({
      where: { videoId },
      orderBy: { sequence: "asc" },
    });
  });

  it("counts chunks for a video", async () => {
    const videoId = randomUUID();

    await repository.countByVideoId(prisma, videoId);

    expect(prisma.chunk.count).toHaveBeenCalledWith({ where: { videoId } });
  });
});
