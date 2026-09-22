import {
  ChunkRepository,
  TranscodeJobRepository,
  type DbClient,
} from "@video-streaming/database";
import type { Resolution } from "@video-streaming/contracts";
import type { ChunkPlanEntry } from "./chunk-plan";

export interface PersistedJob {
  chunkId: string;
  sequence: number;
  startSec: number;
  durationSec: number;
  resolution: Resolution;
}

const chunks = new ChunkRepository();
const transcodeJobs = new TranscodeJobRepository();

export async function persistChunksAndJobs(
  db: DbClient,
  videoId: string,
  sourceKey: string,
  plan: ChunkPlanEntry[],
  resolutions: Resolution[],
): Promise<PersistedJob[]> {
  const createdChunks = await chunks.createMany(
    db,
    plan.map((chunk) => ({
      videoId,
      sequence: chunk.sequence,
      startSec: chunk.startSec,
      durationSec: chunk.durationSec,
      sourceKey,
    })),
  );

  const jobInputs = createdChunks.flatMap((chunk) =>
    resolutions.map((resolution) => ({ videoId, chunkId: chunk.id, resolution })),
  );
  const createdJobs = await transcodeJobs.createMany(db, jobInputs);

  const chunkById = new Map(createdChunks.map((chunk) => [chunk.id, chunk]));

  return createdJobs.map((job) => {
    const chunk = chunkById.get(job.chunkId);
    if (!chunk) {
      throw new Error(`persisted transcode job references unknown chunk ${job.chunkId}`);
    }
    return {
      chunkId: job.chunkId,
      sequence: chunk.sequence,
      startSec: chunk.startSec,
      durationSec: chunk.durationSec,
      resolution: job.resolution as Resolution,
    };
  });
}
