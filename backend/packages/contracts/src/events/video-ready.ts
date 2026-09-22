import { z } from "zod";
import { eventEnvelope } from "../envelope";

export const VideoReadyData = z.object({
  videoId: z.string().uuid(),
  manifestKey: z.string().min(1),
});
export type VideoReadyData = z.infer<typeof VideoReadyData>;

export const VideoReady = eventEnvelope("video.ready", 1, VideoReadyData);
export type VideoReady = z.infer<typeof VideoReady>;
