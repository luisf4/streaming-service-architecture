import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { of } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideosController } from "../../src/videos/videos.controller";
import { VideosService } from "../../src/videos/videos.service";

describe("VideosController (HTTP)", () => {
  let app: INestApplication;
  const videosService = {
    startUpload: vi.fn(),
    presignPart: vi.fn(),
    completeUpload: vi.fn(),
    getVideo: vi.fn(),
    streamStatus: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [VideosController],
      providers: [{ provide: VideosService, useValue: videosService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("POST /videos rejects a payload missing required fields", async () => {
    await request(app.getHttpServer()).post("/videos").send({ title: "only title" }).expect(400);

    expect(videosService.startUpload).not.toHaveBeenCalled();
  });

  it("POST /videos starts an upload for a valid payload", async () => {
    videosService.startUpload.mockResolvedValue({
      videoId: "v1",
      uploadId: "u1",
      bucket: "raw",
      key: "videos/v1/original",
    });

    const response = await request(app.getHttpServer())
      .post("/videos")
      .send({
        title: "My video",
        originalFilename: "a.mp4",
        contentType: "video/mp4",
        sizeBytes: 1024,
      })
      .expect(201);

    expect(response.body).toEqual({
      videoId: "v1",
      uploadId: "u1",
      bucket: "raw",
      key: "videos/v1/original",
    });
  });

  it("POST /videos/:id/uploads/:uploadId/parts/:partNumber/presign forwards params", async () => {
    videosService.presignPart.mockResolvedValue({ url: "https://example.test/x" });

    const response = await request(app.getHttpServer())
      .post("/videos/v1/uploads/u1/parts/3/presign")
      .expect(201);

    expect(videosService.presignPart).toHaveBeenCalledWith("v1", "u1", 3);
    expect(response.body).toEqual({ url: "https://example.test/x" });
  });

  it("GET /videos/:id returns the video", async () => {
    videosService.getVideo.mockResolvedValue({ id: "v1", status: "READY" });

    const response = await request(app.getHttpServer()).get("/videos/v1").expect(200);

    expect(response.body).toEqual({ id: "v1", status: "READY" });
  });

  it("GET /videos/:id serializes fine when the video carries a BigInt sizeBytes (Prisma's real shape)", async () => {
    videosService.getVideo.mockResolvedValue({
      id: "v1",
      title: "t",
      description: null,
      status: "READY",
      originalFilename: "a.mp4",
      sizeBytes: 5242880n,
      durationSec: null,
      manifestKey: "videos/v1/master.m3u8",
      failureReason: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });

    const response = await request(app.getHttpServer()).get("/videos/v1").expect(200);

    expect(response.body.sizeBytes).toBeUndefined();
    expect(response.body.id).toBe("v1");
  });

  it("GET /videos/:id/events streams status updates as SSE", async () => {
    videosService.streamStatus.mockReturnValue(
      of({ status: "READY", manifestKey: "videos/v1/master.m3u8", failureReason: null }),
    );

    const response = await request(app.getHttpServer()).get("/videos/v1/events").expect(200);

    expect(videosService.streamStatus).toHaveBeenCalledWith("v1");
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.text).toContain('data: {"status":"READY"');
  });
});
