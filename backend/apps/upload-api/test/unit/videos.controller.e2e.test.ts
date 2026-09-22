import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
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
});
