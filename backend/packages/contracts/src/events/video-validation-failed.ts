import { z } from "zod";
import { eventEnvelope } from "../envelope";

export const VideoValidationFailedData = z.object({
  videoId: z.string().uuid(),
  reason: z.string().min(1),
});
export type VideoValidationFailedData = z.infer<typeof VideoValidationFailedData>;

export const VideoValidationFailed = eventEnvelope(
  "video.validation.failed",
  1,
  VideoValidationFailedData,
);
export type VideoValidationFailed = z.infer<typeof VideoValidationFailed>;
