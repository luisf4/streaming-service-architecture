import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@video-streaming/database";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { StatusConsumerService } from "../../src/status/status-consumer.service";

describe("StatusConsumerService.handleEvent", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let service: StatusConsumerService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    mockReset(prisma);
    // channel and config are unused by handleEvent directly; casts keep the constructor happy.
    service = new StatusConsumerService(prisma, {} as never, {} as never);
  });

  it("marks the video READY with the manifest key on video.ready", async () => {
    const videoId = randomUUID();

    await service.handleEvent({
      eventType: "video.ready",
      data: { videoId, manifestKey: "hls/x/master.m3u8" },
    });

    expect(prisma.video.update).toHaveBeenCalledWith({
      where: { id: videoId },
      data: { status: "READY", manifestKey: "hls/x/master.m3u8" },
    });
  });

  it("marks the video FAILED with the reason on video.validation.failed", async () => {
    const videoId = randomUUID();

    await service.handleEvent({
      eventType: "video.validation.failed",
      data: { videoId, reason: "unsupported codec" },
    });

    expect(prisma.video.update).toHaveBeenCalledWith({
      where: { id: videoId },
      data: { status: "FAILED", failureReason: "unsupported codec" },
    });
  });

  it("marks the video FAILED with the reason on video.transcode.failed", async () => {
    const videoId = randomUUID();

    await service.handleEvent({
      eventType: "video.transcode.failed",
      data: { videoId, reason: "ffmpeg crashed" },
    });

    expect(prisma.video.update).toHaveBeenCalledWith({
      where: { id: videoId },
      data: { status: "FAILED", failureReason: "ffmpeg crashed" },
    });
  });

  it("ignores unrelated event types without touching the database", async () => {
    await service.handleEvent({ eventType: "video.something.else", data: {} });

    expect(prisma.video.update).not.toHaveBeenCalled();
  });
});
