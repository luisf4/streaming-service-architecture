import "reflect-metadata";
import { ConflictException, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideosController } from "../../src/videos/videos.controller";
import { VideosService } from "../../src/videos/videos.service";

describe("VideosController (HTTP)", () => {
  let app: INestApplication;
  const videosService = { getPlayUrl: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [VideosController],
      providers: [{ provide: VideosService, useValue: videosService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /videos/:id/play returns the manifest URL", async () => {
    videosService.getPlayUrl.mockResolvedValue({
      manifestUrl: "https://example.test/master.m3u8",
      expiresInSec: 3600,
    });

    const response = await request(app.getHttpServer()).get("/videos/v1/play").expect(200);

    expect(videosService.getPlayUrl).toHaveBeenCalledWith("v1");
    expect(response.body).toEqual({ manifestUrl: "https://example.test/master.m3u8", expiresInSec: 3600 });
  });

  it("GET /videos/:id/play returns 409 when the video is not ready", async () => {
    videosService.getPlayUrl.mockRejectedValue(new ConflictException("not ready"));

    await request(app.getHttpServer()).get("/videos/v1/play").expect(409);
  });
});
