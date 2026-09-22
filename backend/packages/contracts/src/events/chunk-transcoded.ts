import { z } from "zod";
import { eventEnvelope } from "../envelope";
import { Resolution } from "../common";

export const ChunkTranscodedData = z.object({
  videoId: z.string().uuid(),
  chunkId: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  resolution: Resolution,
  segmentKey: z.string().min(1),
  segmentDurationSec: z.number().positive(),
});
export type ChunkTranscodedData = z.infer<typeof ChunkTranscodedData>;

export const ChunkTranscoded = eventEnvelope("chunk.transcoded", 1, ChunkTranscodedData);
export type ChunkTranscoded = z.infer<typeof ChunkTranscoded>;
