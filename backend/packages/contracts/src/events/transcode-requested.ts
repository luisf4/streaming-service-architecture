import { z } from "zod";
import { eventEnvelope } from "../envelope";
import { Resolution } from "../common";

export const TranscodeRequestedData = z.object({
  videoId: z.string().uuid(),
  chunkId: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  resolution: Resolution,
  sourceKey: z.string().min(1),
  startSec: z.number().nonnegative(),
  durationSec: z.number().positive(),
});
export type TranscodeRequestedData = z.infer<typeof TranscodeRequestedData>;

export const TranscodeRequested = eventEnvelope(
  "transcode.requested",
  1,
  TranscodeRequestedData,
);
export type TranscodeRequested = z.infer<typeof TranscodeRequested>;
