import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { VideoRepository, type PrismaClient } from "@video-streaming/database";
import { StorageClient } from "@video-streaming/storage";
import { MANIFEST_URL_EXPIRY_SEC, PRISMA_CLIENT, STORAGE_CLIENT } from "../tokens";
import type { PlayResponseDto } from "./play-response.dto";

const videos = new VideoRepository();

@Injectable()
export class VideosService {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(STORAGE_CLIENT) private readonly storage: StorageClient,
    @Inject(MANIFEST_URL_EXPIRY_SEC) private readonly manifestUrlExpirySec: number,
  ) {}

  async getPlayUrl(videoId: string): Promise<PlayResponseDto> {
    const video = await videos.findById(this.prisma, videoId);
    if (!video) {
      throw new NotFoundException(`Video ${videoId} not found`);
    }
    if (video.status !== "READY" || !video.manifestKey) {
      throw new ConflictException(`Video ${videoId} is not ready yet (status: ${video.status})`);
    }

    const manifestUrl = await this.storage.presignGetObject(video.manifestKey, this.manifestUrlExpirySec);
    return { manifestUrl, expiresInSec: this.manifestUrlExpirySec };
  }
}
