import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  EXCHANGES,
  ROUTING_KEYS,
  type ChunkTranscoded,
  type TranscodeRequested,
} from "@video-streaming/contracts";
import type { EventPublisher } from "@video-streaming/messaging";
import type { TranscodeOptions } from "./transcode";

export interface HandlerDeps {
  publisher: Pick<EventPublisher, "publish">;
  presignGet: (key: string) => Promise<string>;
  transcode: (options: TranscodeOptions) => Promise<void>;
  putObject: (key: string, body: Buffer) => Promise<void>;
  tmpDir?: string;
  ffmpegPath?: string;
}

export function segmentKey(videoId: string, resolution: string, sequence: number): string {
  return `videos/${videoId}/${resolution}/segment-${String(sequence).padStart(5, "0")}.ts`;
}

export async function handleTranscodeRequested(event: TranscodeRequested, deps: HandlerDeps): Promise<void> {
  const { videoId, chunkId, sequence, resolution, sourceKey, startSec, durationSec } = event.data;

  const inputUrl = await deps.presignGet(sourceKey);
  const outputPath = path.join(deps.tmpDir ?? os.tmpdir(), `${chunkId}-${resolution}-${randomUUID()}.ts`);

  try {
    await deps.transcode({
      inputUrl,
      startSec,
      durationSec,
      resolution,
      outputPath,
      ffmpegPath: deps.ffmpegPath,
    });

    const body = await readFile(outputPath);
    const key = segmentKey(videoId, resolution, sequence);
    await deps.putObject(key, body);

    const transcoded: ChunkTranscoded = {
      eventId: randomUUID(),
      eventType: "chunk.transcoded",
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      correlationId: event.correlationId,
      data: {
        videoId,
        chunkId,
        sequence,
        resolution,
        segmentKey: key,
        segmentDurationSec: durationSec,
      },
    };
    deps.publisher.publish(EXCHANGES.videoEvents, ROUTING_KEYS.chunkTranscoded, transcoded);
  } finally {
    await rm(outputPath, { force: true });
  }
}
