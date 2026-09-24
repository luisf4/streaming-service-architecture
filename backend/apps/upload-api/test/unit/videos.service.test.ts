import { randomUUID } from "node:crypto";
import { NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@video-streaming/database";
import type { StorageClient } from "@video-streaming/storage";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { VideosService } from "../../src/videos/videos.service";

function fakeStorage() {
  return {
    createMultipartUpload: vi.fn().mockResolvedValue("upload-1"),
    presignUploadPart: vi.fn().mockResolvedValue("https://example.test/presigned-part"),
    completeMultipartUpload: vi.fn().mockResolvedValue(undefined),
  } as unknown as StorageClient;
}

describe("VideosService", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let storage: ReturnType<typeof fakeStorage>;
  let service: VideosService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    mockReset(prisma);
    storage = fakeStorage();
    service = new VideosService(prisma, storage, "raw");
  });

  describe("startUpload", () => {
    it("creates the video row and a multipart upload scoped to the video id", async () => {
      const videoId = randomUUID();
      prisma.video.create.mockResolvedValue({ id: videoId } as never);

      const result = await service.startUpload({
        title: "My video",
        originalFilename: "a.mp4",
        contentType: "video/mp4",
        sizeBytes: 1024,
      });

      expect(prisma.video.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ title: "My video", originalFilename: "a.mp4" }),
      });
      expect(storage.createMultipartUpload).toHaveBeenCalledWith(`videos/${videoId}/original`, "video/mp4");
      expect(result).toEqual({
        videoId,
        uploadId: "upload-1",
        bucket: "raw",
        key: `videos/${videoId}/original`,
      });
    });
  });

  describe("presignPart", () => {
    it("presigns a part URL for the video's storage key", async () => {
      const videoId = randomUUID();

      const result = await service.presignPart(videoId, "upload-1", 2);

      expect(storage.presignUploadPart).toHaveBeenCalledWith(`videos/${videoId}/original`, "upload-1", 2);
      expect(result).toEqual({ url: "https://example.test/presigned-part" });
    });
  });

  describe("completeUpload", () => {
    it("throws NotFoundException when the video does not exist", async () => {
      prisma.video.findUnique.mockResolvedValue(null);

      await expect(
        service.completeUpload(randomUUID(), { uploadId: "u1", parts: [{ partNumber: 1, etag: "e1" }] }),
      ).rejects.toThrow(NotFoundException);
    });

    it("completes the multipart upload, updates status and enqueues the outbox event atomically", async () => {
      const videoId = randomUUID();
      prisma.video.findUnique.mockResolvedValue({
        id: videoId,
        sizeBytes: 2048n,
        originalFilename: "a.mp4",
      } as never);
      prisma.$transaction.mockImplementation((fn: unknown) =>
        (fn as (tx: PrismaClient) => Promise<unknown>)(prisma),
      );
      prisma.video.update.mockResolvedValue({ id: videoId, status: "UPLOADED" } as never);

      const result = await service.completeUpload(videoId, {
        uploadId: "upload-1",
        parts: [{ partNumber: 1, etag: "etag-1" }],
      });

      expect(storage.completeMultipartUpload).toHaveBeenCalledWith(
        `videos/${videoId}/original`,
        "upload-1",
        [{ partNumber: 1, etag: "etag-1" }],
      );
      expect(prisma.video.update).toHaveBeenCalledWith({
        where: { id: videoId },
        data: { status: "UPLOADED" },
      });
      expect(prisma.outboxMessage.create).toHaveBeenCalledTimes(1);
      const outboxPayload = prisma.outboxMessage.create.mock.calls[0][0].data as {
        exchange: string;
        routingKey: string;
        payload: { data: { videoId: string; sizeBytes: number; originalFilename: string } };
      };
      expect(outboxPayload.exchange).toBe("video.events");
      expect(outboxPayload.routingKey).toBe("video.uploaded");
      expect(outboxPayload.payload.data).toEqual({
        videoId,
        storageKey: `videos/${videoId}/original`,
        sizeBytes: 2048,
        originalFilename: "a.mp4",
      });
      expect(result).toEqual({ id: videoId, status: "UPLOADED" });
    });
  });

  describe("getVideo", () => {
    it("throws NotFoundException when missing", async () => {
      prisma.video.findUnique.mockResolvedValue(null);

      await expect(service.getVideo(randomUUID())).rejects.toThrow(NotFoundException);
    });

    it("returns the video when found", async () => {
      const videoId = randomUUID();
      prisma.video.findUnique.mockResolvedValue({ id: videoId } as never);

      await expect(service.getVideo(videoId)).resolves.toEqual({ id: videoId });
    });
  });

  describe("listVideos", () => {
    it("returns every video, most recently created first", async () => {
      const videos = [{ id: "v2" }, { id: "v1" }];
      prisma.video.findMany.mockResolvedValue(videos as never);

      await expect(service.listVideos()).resolves.toEqual(videos);
      expect(prisma.video.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "desc" } });
    });
  });
});
