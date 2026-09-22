import type { PrismaClient, VideoStatus } from "@prisma/client";

export interface CreateVideoInput {
  title: string;
  description?: string;
}

export interface UpdateVideoStatusExtra {
  manifestKey?: string;
  failureReason?: string;
  durationSec?: number;
}

export class VideoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateVideoInput) {
    return this.prisma.video.create({ data: input });
  }

  async findById(id: string) {
    return this.prisma.video.findUnique({ where: { id } });
  }

  async updateStatus(id: string, status: VideoStatus, extra: UpdateVideoStatusExtra = {}) {
    return this.prisma.video.update({ where: { id }, data: { status, ...extra } });
  }
}
