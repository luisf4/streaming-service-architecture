import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { RenditionRepository } from "../../src/rendition-repository";

describe("RenditionRepository", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let repository: RenditionRepository;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    mockReset(prisma);
    repository = new RenditionRepository();
  });

  it("creates a rendition row", async () => {
    const videoId = randomUUID();
    const chunkId = randomUUID();

    await repository.create(prisma, {
      videoId,
      chunkId,
      resolution: "360p",
      segmentKey: "videos/v1/360p/segment-00000.ts",
      sequence: 0,
      segmentDuration: 2,
    });

    expect(prisma.rendition.create).toHaveBeenCalledWith({
      data: {
        videoId,
        chunkId,
        resolution: "360p",
        segmentKey: "videos/v1/360p/segment-00000.ts",
        sequence: 0,
        segmentDuration: 2,
      },
    });
  });

  it("counts renditions for a video and resolution", async () => {
    const videoId = randomUUID();

    await repository.countByVideoAndResolution(prisma, videoId, "360p");

    expect(prisma.rendition.count).toHaveBeenCalledWith({ where: { videoId, resolution: "360p" } });
  });

  it("finds renditions for a video and resolution ordered by sequence", async () => {
    const videoId = randomUUID();

    await repository.findByVideoAndResolution(prisma, videoId, "360p");

    expect(prisma.rendition.findMany).toHaveBeenCalledWith({
      where: { videoId, resolution: "360p" },
      orderBy: { sequence: "asc" },
    });
  });
});
