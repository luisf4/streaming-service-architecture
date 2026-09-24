import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient, Video } from "@video-streaming/database";
import { OutboxRepository, VideoRepository } from "@video-streaming/database";
import { EXCHANGES, ROUTING_KEYS, type VideoUploaded } from "@video-streaming/contracts";
import { StorageClient } from "@video-streaming/storage";
import { timer, type Observable } from "rxjs";
import { PRISMA_CLIENT, RAW_BUCKET, STORAGE_CLIENT } from "../tokens";
import { createStatusStream, type StatusPayload } from "../status/status-stream";
import type { CompleteUploadDto } from "./dto/complete-upload.dto";
import type { CreateVideoDto } from "./dto/create-video.dto";

const STATUS_POLL_INTERVAL_MS = 1_000;

export interface StartUploadResult {
  videoId: string;
  uploadId: string;
  bucket: string;
  key: string;
}

function storageKey(videoId: string): string {
  return `videos/${videoId}/original`;
}

@Injectable()
export class VideosService {
  private readonly videos = new VideoRepository();
  private readonly outbox = new OutboxRepository();

  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(STORAGE_CLIENT) private readonly storage: StorageClient,
    @Inject(RAW_BUCKET) private readonly bucket: string,
  ) {}

  async startUpload(dto: CreateVideoDto): Promise<StartUploadResult> {
    const video = await this.videos.create(this.prisma, {
      title: dto.title,
      description: dto.description,
      originalFilename: dto.originalFilename,
      sizeBytes: dto.sizeBytes,
    });

    const key = storageKey(video.id);
    const uploadId = await this.storage.createMultipartUpload(key, dto.contentType);

    return { videoId: video.id, uploadId, bucket: this.bucket, key };
  }

  async presignPart(videoId: string, uploadId: string, partNumber: number): Promise<{ url: string }> {
    const url = await this.storage.presignUploadPart(storageKey(videoId), uploadId, partNumber);
    return { url };
  }

  async completeUpload(videoId: string, dto: CompleteUploadDto): Promise<Video> {
    const video = await this.videos.findById(this.prisma, videoId);
    if (!video) {
      throw new NotFoundException(`Video ${videoId} not found`);
    }

    const key = storageKey(videoId);
    await this.storage.completeMultipartUpload(
      key,
      dto.uploadId,
      dto.parts.map((part) => ({ partNumber: part.partNumber, etag: part.etag })),
    );

    const event: VideoUploaded = {
      eventId: randomUUID(),
      eventType: "video.uploaded",
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      data: {
        videoId,
        storageKey: key,
        sizeBytes: video.sizeBytes ? Number(video.sizeBytes) : 0,
        originalFilename: video.originalFilename ?? "unknown",
      },
    };

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.videos.updateStatus(tx, videoId, "UPLOADED");
      await this.outbox.enqueue(tx, {
        exchange: EXCHANGES.videoEvents,
        routingKey: ROUTING_KEYS.videoUploaded,
        payload: event,
      });
      return updated;
    });
  }

  async getVideo(videoId: string): Promise<Video> {
    const video = await this.videos.findById(this.prisma, videoId);
    if (!video) {
      throw new NotFoundException(`Video ${videoId} not found`);
    }
    return video;
  }

  async listVideos(): Promise<Video[]> {
    return this.videos.findAll(this.prisma);
  }

  streamStatus(videoId: string): Observable<StatusPayload> {
    const poll = async (): Promise<StatusPayload | null> => {
      const video = await this.videos.findById(this.prisma, videoId);
      if (!video) return null;
      return {
        status: video.status,
        manifestKey: video.manifestKey,
        failureReason: video.failureReason,
      };
    };
    return createStatusStream(poll, timer(0, STATUS_POLL_INTERVAL_MS));
  }
}
