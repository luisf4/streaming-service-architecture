import { z } from "zod";
import { eventEnvelope } from "../envelope";

export const VideoValidatedData = z.object({
  videoId: z.string().uuid(),
  durationSec: z.number().positive(),
  format: z.string().min(1),
  storageKey: z.string().min(1),
});
export type VideoValidatedData = z.infer<typeof VideoValidatedData>;

export const VideoValidated = eventEnvelope("video.validated", 1, VideoValidatedData);
export type VideoValidated = z.infer<typeof VideoValidated>;
