import { randomUUID } from "node:crypto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@video-streaming/database";
import type { StorageClient } from "@video-streaming/storage";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { VideosService } from "../../src/videos/videos.service";

function fakeStorage() {
  return {
    presignGetObject: vi.fn().mockResolvedValue("https://example.test/presigned-manifest"),
  } as unknown as StorageClient;
}

describe("VideosService.getPlayUrl", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let storage: ReturnType<typeof fakeStorage>;
  let service: VideosService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    mockReset(prisma);
    storage = fakeStorage();
    service = new VideosService(prisma, storage, 3600);
  });

  it("throws NotFoundException when the video does not exist", async () => {
    prisma.video.findUnique.mockResolvedValue(null);

    await expect(service.getPlayUrl(randomUUID())).rejects.toThrow(NotFoundException);
  });

  it("throws ConflictException when the video is not READY", async () => {
    prisma.video.findUnique.mockResolvedValue({ status: "PROCESSING", manifestKey: null } as never);

    await expect(service.getPlayUrl(randomUUID())).rejects.toThrow(ConflictException);
  });

  it("returns a presigned manifest URL for a READY video", async () => {
    const videoId = randomUUID();
    prisma.video.findUnique.mockResolvedValue({
      status: "READY",
      manifestKey: `videos/${videoId}/master.m3u8`,
    } as never);

    const result = await service.getPlayUrl(videoId);

    expect(storage.presignGetObject).toHaveBeenCalledWith(`videos/${videoId}/master.m3u8`, 3600);
    expect(result).toEqual({ manifestUrl: "https://example.test/presigned-manifest", expiresInSec: 3600 });
  });
});
