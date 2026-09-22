import type { VideoStatus } from "@prisma/client";
import type { DbClient } from "./outbox";

export interface CreateVideoInput {
  title: string;
  description?: string;
  originalFilename?: string;
  sizeBytes?: number;
}

export interface UpdateVideoStatusExtra {
  manifestKey?: string;
  failureReason?: string;
  durationSec?: number;
}

export class VideoRepository {
  async create(db: DbClient, input: CreateVideoInput) {
    return db.video.create({
      data: {
        ...input,
        sizeBytes: input.sizeBytes !== undefined ? BigInt(input.sizeBytes) : undefined,
      },
    });
  }

  async findById(db: DbClient, id: string) {
    return db.video.findUnique({ where: { id } });
  }

  async updateStatus(db: DbClient, id: string, status: VideoStatus, extra: UpdateVideoStatusExtra = {}) {
    return db.video.update({ where: { id }, data: { status, ...extra } });
  }
}
