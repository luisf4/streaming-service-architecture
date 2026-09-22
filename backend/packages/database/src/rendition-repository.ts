import type { Rendition } from "@prisma/client";
import type { DbClient } from "./outbox";

export interface CreateRenditionInput {
  videoId: string;
  chunkId: string;
  resolution: string;
  segmentKey: string;
  sequence: number;
  segmentDuration: number;
}

export class RenditionRepository {
  async create(db: DbClient, input: CreateRenditionInput): Promise<Rendition> {
    return db.rendition.create({ data: input });
  }

  async countByVideoAndResolution(db: DbClient, videoId: string, resolution: string): Promise<number> {
    return db.rendition.count({ where: { videoId, resolution } });
  }

  async findByVideoAndResolution(db: DbClient, videoId: string, resolution: string): Promise<Rendition[]> {
    return db.rendition.findMany({
      where: { videoId, resolution },
      orderBy: { sequence: "asc" },
    });
  }
}
