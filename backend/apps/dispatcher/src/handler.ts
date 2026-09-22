import { randomUUID } from "node:crypto";
import {
  EXCHANGES,
  ROUTING_KEYS,
  type Resolution,
  type TranscodeRequested,
  type VideoValidated,
} from "@video-streaming/contracts";
import type { DbClient } from "@video-streaming/database";
import type { EventPublisher } from "@video-streaming/messaging";
import { planChunks } from "./chunk-plan";
import { persistChunksAndJobs } from "./persist-chunks";

export const TARGET_CHUNK_SEC = 6;
export const RESOLUTIONS: Resolution[] = ["360p", "720p"];

export interface HandlerDeps {
  db: DbClient;
  publisher: Pick<EventPublisher, "publish">;
  getKeyframes: (url: string) => Promise<number[]>;
  presignGet: (key: string) => Promise<string>;
  targetChunkSec?: number;
  resolutions?: Resolution[];
}

export async function handleVideoValidated(event: VideoValidated, deps: HandlerDeps): Promise<void> {
  const { videoId, storageKey, durationSec } = event.data;

  const url = await deps.presignGet(storageKey);
  const keyframes = await deps.getKeyframes(url);
  const plan = planChunks(keyframes, durationSec, deps.targetChunkSec ?? TARGET_CHUNK_SEC);

  const jobs = await persistChunksAndJobs(
    deps.db,
    videoId,
    storageKey,
    plan,
    deps.resolutions ?? RESOLUTIONS,
  );

  for (const job of jobs) {
    const requested: TranscodeRequested = {
      eventId: randomUUID(),
      eventType: "transcode.requested",
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      correlationId: event.correlationId,
      data: {
        videoId,
        chunkId: job.chunkId,
        sequence: job.sequence,
        resolution: job.resolution,
        sourceKey: storageKey,
        startSec: job.startSec,
        durationSec: job.durationSec,
      },
    };
    deps.publisher.publish(EXCHANGES.transcodeJobs, ROUTING_KEYS.transcodeRequested, requested);
  }
}
