import type { Chunk } from "@prisma/client";
import type { DbClient } from "./outbox";

export interface CreateChunkInput {
  videoId: string;
  sequence: number;
  startSec: number;
  durationSec: number;
  sourceKey: string;
}

export class ChunkRepository {
  async createMany(db: DbClient, inputs: CreateChunkInput[]): Promise<Chunk[]> {
    const created: Chunk[] = [];
    for (const input of inputs) {
      created.push(await db.chunk.create({ data: input }));
    }
    return created;
  }

  async findByVideoId(db: DbClient, videoId: string): Promise<Chunk[]> {
    return db.chunk.findMany({ where: { videoId }, orderBy: { sequence: "asc" } });
  }

  async countByVideoId(db: DbClient, videoId: string): Promise<number> {
    return db.chunk.count({ where: { videoId } });
  }
}
