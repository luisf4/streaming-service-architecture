import { randomUUID } from "node:crypto";
import {
  ChunkRepository,
  RenditionRepository,
  TranscodeJobRepository,
  type DbClient,
} from "@video-streaming/database";
import {
  EXCHANGES,
  ROUTING_KEYS,
  type ChunkTranscoded,
  type Resolution,
  type VideoReady,
} from "@video-streaming/contracts";
import type { EventPublisher } from "@video-streaming/messaging";
import { buildMasterPlaylist, buildResolutionPlaylist } from "./playlist";

export interface HandlerDeps {
  db: DbClient;
  publisher: Pick<EventPublisher, "publish">;
  putObject: (key: string, body: string) => Promise<void>;
}

const chunks = new ChunkRepository();
const renditions = new RenditionRepository();
const transcodeJobs = new TranscodeJobRepository();

export function manifestKey(videoId: string): string {
  return `videos/${videoId}/master.m3u8`;
}

export function resolutionPlaylistKey(videoId: string, resolution: string): string {
  return `videos/${videoId}/${resolution}/playlist.m3u8`;
}

export async function handleChunkTranscoded(event: ChunkTranscoded, deps: HandlerDeps): Promise<void> {
  const { videoId, chunkId, sequence, resolution, segmentKey, segmentDurationSec } = event.data;

  await renditions.create(deps.db, {
    videoId,
    chunkId,
    resolution,
    segmentKey,
    sequence,
    segmentDuration: segmentDurationSec,
  });

  const totalChunks = await chunks.countByVideoId(deps.db, videoId);
  const renditionCount = await renditions.countByVideoAndResolution(deps.db, videoId, resolution);

  if (renditionCount < totalChunks) {
    // This resolution isn't fully transcoded yet - nothing more to do.
    return;
  }

  const segments = await renditions.findByVideoAndResolution(deps.db, videoId, resolution);
  const resolutionPlaylist = buildResolutionPlaylist(
    segments.map((s) => ({ sequence: s.sequence, segmentDuration: s.segmentDuration, segmentKey: s.segmentKey })),
  );
  await deps.putObject(resolutionPlaylistKey(videoId, resolution), resolutionPlaylist);

  const expectedResolutions = await transcodeJobs.distinctResolutions(deps.db, videoId);
  const readyResolutions = await Promise.all(
    expectedResolutions.map(async (candidate) => {
      const count = await renditions.countByVideoAndResolution(deps.db, videoId, candidate);
      return count >= totalChunks;
    }),
  );
  const allResolutionsReady = readyResolutions.every(Boolean);

  if (!allResolutionsReady) {
    return;
  }

  const key = manifestKey(videoId);
  const master = buildMasterPlaylist(expectedResolutions as Resolution[]);
  await deps.putObject(key, master);

  // Per the plan's status ownership table, only upload-api writes
  // Video.status - it does so when it consumes this very event.
  const ready: VideoReady = {
    eventId: randomUUID(),
    eventType: "video.ready",
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    correlationId: event.correlationId,
    data: { videoId, manifestKey: key },
  };
  deps.publisher.publish(EXCHANGES.videoEvents, ROUTING_KEYS.videoReady, ready);
}
