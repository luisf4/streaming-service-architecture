import { z } from "zod";
import { VideoUploaded } from "./events/video-uploaded";
import { VideoValidated } from "./events/video-validated";
import { VideoValidationFailed } from "./events/video-validation-failed";
import { TranscodeRequested } from "./events/transcode-requested";
import { ChunkTranscoded } from "./events/chunk-transcoded";
import { VideoTranscodeFailed } from "./events/video-transcode-failed";
import { VideoReady } from "./events/video-ready";

export type EventType =
  | "video.uploaded"
  | "video.validated"
  | "video.validation.failed"
  | "transcode.requested"
  | "chunk.transcoded"
  | "video.transcode.failed"
  | "video.ready";

export const EVENT_SCHEMAS: Record<EventType, z.ZodTypeAny> = {
  "video.uploaded": VideoUploaded,
  "video.validated": VideoValidated,
  "video.validation.failed": VideoValidationFailed,
  "transcode.requested": TranscodeRequested,
  "chunk.transcoded": ChunkTranscoded,
  "video.transcode.failed": VideoTranscodeFailed,
  "video.ready": VideoReady,
};

export type AnyDomainEvent =
  | VideoUploaded
  | VideoValidated
  | VideoValidationFailed
  | TranscodeRequested
  | ChunkTranscoded
  | VideoTranscodeFailed
  | VideoReady;

export class UnknownEventTypeError extends Error {
  constructor(eventType: string) {
    super(`Unknown event type: ${eventType}`);
    this.name = "UnknownEventTypeError";
  }
}

export function parseEvent(raw: unknown): AnyDomainEvent {
  const candidate = raw as { eventType?: unknown };
  const eventType = candidate?.eventType;
  if (typeof eventType !== "string" || !(eventType in EVENT_SCHEMAS)) {
    throw new UnknownEventTypeError(String(eventType));
  }
  const schema = EVENT_SCHEMAS[eventType as EventType];
  return schema.parse(raw) as AnyDomainEvent;
}
