import { randomUUID } from "node:crypto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@video-streaming/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { ManifestUrlSigner } from "../../src/videos/manifest-url-signer";
import { VideosService } from "../../src/videos/videos.service";

function fakeSigner(): ManifestUrlSigner {
  return {
    sign: vi.fn().mockResolvedValue("https://example.test/presigned-manifest"),
  };
}

describe("VideosService.getPlayUrl", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let signer: ManifestUrlSigner;
  let service: VideosService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    mockReset(prisma);
    signer = fakeSigner();
    service = new VideosService(prisma, signer, 3600);
  });

  it("throws NotFoundException when the video does not exist", async () => {
    prisma.video.findUnique.mockResolvedValue(null);

    await expect(service.getPlayUrl(randomUUID())).rejects.toThrow(NotFoundException);
  });

  it("throws ConflictException when the video is not READY", async () => {
    prisma.video.findUnique.mockResolvedValue({ status: "PROCESSING", manifestKey: null } as never);

    await expect(service.getPlayUrl(randomUUID())).rejects.toThrow(ConflictException);
  });

  it("returns a signed manifest URL for a READY video", async () => {
    const videoId = randomUUID();
    prisma.video.findUnique.mockResolvedValue({
      status: "READY",
      manifestKey: `videos/${videoId}/master.m3u8`,
    } as never);

    const result = await service.getPlayUrl(videoId);

    expect(signer.sign).toHaveBeenCalledWith(`videos/${videoId}/master.m3u8`, 3600);
    expect(result).toEqual({ manifestUrl: "https://example.test/presigned-manifest", expiresInSec: 3600 });
  });
});
