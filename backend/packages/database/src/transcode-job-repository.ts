import type { TranscodeJob, TranscodeJobStatus } from "@prisma/client";
import type { DbClient } from "./outbox";

export interface CreateTranscodeJobInput {
  videoId: string;
  chunkId: string;
  resolution: string;
}

export interface UpdateTranscodeJobStatusExtra {
  failureReason?: string;
}

export class TranscodeJobRepository {
  async createMany(db: DbClient, inputs: CreateTranscodeJobInput[]): Promise<TranscodeJob[]> {
    const created: TranscodeJob[] = [];
    for (const input of inputs) {
      created.push(await db.transcodeJob.create({ data: input }));
    }
    return created;
  }

  async updateStatus(
    db: DbClient,
    id: string,
    status: TranscodeJobStatus,
    extra: UpdateTranscodeJobStatusExtra = {},
  ): Promise<TranscodeJob> {
    return db.transcodeJob.update({ where: { id }, data: { status, ...extra } });
  }

  async countByVideoAndStatus(db: DbClient, videoId: string, status: TranscodeJobStatus): Promise<number> {
    return db.transcodeJob.count({ where: { videoId, status } });
  }

  async countByVideoId(db: DbClient, videoId: string): Promise<number> {
    return db.transcodeJob.count({ where: { videoId } });
  }
}
