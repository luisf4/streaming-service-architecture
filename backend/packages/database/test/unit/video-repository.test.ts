import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { VideoRepository } from "../../src/video-repository";

describe("VideoRepository", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let repository: VideoRepository;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    mockReset(prisma);
    repository = new VideoRepository(prisma);
  });

  it("creates a video with the given title and description", async () => {
    await repository.create({ title: "My video", description: "desc" });

    expect(prisma.video.create).toHaveBeenCalledWith({
      data: { title: "My video", description: "desc" },
    });
  });

  it("finds a video by id", async () => {
    const id = randomUUID();

    await repository.findById(id);

    expect(prisma.video.findUnique).toHaveBeenCalledWith({ where: { id } });
  });

  it("updates status plus any extra fields", async () => {
    const id = randomUUID();

    await repository.updateStatus(id, "READY", { manifestKey: "hls/x/master.m3u8" });

    expect(prisma.video.update).toHaveBeenCalledWith({
      where: { id },
      data: { status: "READY", manifestKey: "hls/x/master.m3u8" },
    });
  });
});
