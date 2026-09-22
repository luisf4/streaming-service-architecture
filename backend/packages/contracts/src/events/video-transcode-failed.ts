import { z } from "zod";
import { eventEnvelope } from "../envelope";
import { Resolution } from "../common";

export const VideoTranscodeFailedData = z.object({
  videoId: z.string().uuid(),
  chunkId: z.string().uuid(),
  resolution: Resolution,
  reason: z.string().min(1),
});
export type VideoTranscodeFailedData = z.infer<typeof VideoTranscodeFailedData>;

export const VideoTranscodeFailed = eventEnvelope(
  "video.transcode.failed",
  1,
  VideoTranscodeFailedData,
);
export type VideoTranscodeFailed = z.infer<typeof VideoTranscodeFailed>;
