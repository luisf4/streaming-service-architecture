import { z } from "zod";
import { eventEnvelope } from "../envelope";

export const VideoUploadedData = z.object({
  videoId: z.string().uuid(),
  storageKey: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  originalFilename: z.string().min(1),
});
export type VideoUploadedData = z.infer<typeof VideoUploadedData>;

export const VideoUploaded = eventEnvelope("video.uploaded", 1, VideoUploadedData);
export type VideoUploaded = z.infer<typeof VideoUploaded>;
