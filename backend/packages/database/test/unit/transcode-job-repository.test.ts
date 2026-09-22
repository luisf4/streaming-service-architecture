import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { TranscodeJobRepository } from "../../src/transcode-job-repository";

describe("TranscodeJobRepository", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let repository: TranscodeJobRepository;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    mockReset(prisma);
    repository = new TranscodeJobRepository();
  });

  it("creates one row per (chunk, resolution) input", async () => {
    const videoId = randomUUID();
    const chunkId = randomUUID();

    await repository.createMany(prisma, [
      { videoId, chunkId, resolution: "360p" },
      { videoId, chunkId, resolution: "720p" },
    ]);

    expect(prisma.transcodeJob.create).toHaveBeenCalledTimes(2);
    expect(prisma.transcodeJob.create).toHaveBeenNthCalledWith(1, {
      data: { videoId, chunkId, resolution: "360p" },
    });
  });

  it("updates status plus any extra fields", async () => {
    const id = randomUUID();

    await repository.updateStatus(prisma, id, "DONE");

    expect(prisma.transcodeJob.update).toHaveBeenCalledWith({
      where: { id },
      data: { status: "DONE" },
    });
  });

  it("counts jobs for a video by status", async () => {
    const videoId = randomUUID();

    await repository.countByVideoAndStatus(prisma, videoId, "DONE");

    expect(prisma.transcodeJob.count).toHaveBeenCalledWith({
      where: { videoId, status: "DONE" },
    });
  });

  it("counts all jobs for a video", async () => {
    const videoId = randomUUID();

    await repository.countByVideoId(prisma, videoId);

    expect(prisma.transcodeJob.count).toHaveBeenCalledWith({ where: { videoId } });
  });

  it("lists the distinct resolutions requested for a video", async () => {
    const videoId = randomUUID();
    prisma.transcodeJob.findMany.mockResolvedValue([
      { resolution: "360p" },
      { resolution: "720p" },
    ] as never);

    const resolutions = await repository.distinctResolutions(prisma, videoId);

    expect(prisma.transcodeJob.findMany).toHaveBeenCalledWith({
      where: { videoId },
      distinct: ["resolution"],
      select: { resolution: true },
    });
    expect(resolutions).toEqual(["360p", "720p"]);
  });
});
