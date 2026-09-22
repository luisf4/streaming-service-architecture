import { randomUUID } from "node:crypto";
import {
  EXCHANGES,
  ROUTING_KEYS,
  type VideoUploaded,
  type VideoValidated,
  type VideoValidationFailed,
} from "@video-streaming/contracts";
import type { EventPublisher } from "@video-streaming/messaging";
import type { ProbeResult } from "./ffprobe";

export interface HandlerDeps {
  publisher: Pick<EventPublisher, "publish">;
  probe: (url: string) => Promise<ProbeResult>;
  presignGet: (key: string) => Promise<string>;
}

export async function handleVideoUploaded(event: VideoUploaded, deps: HandlerDeps): Promise<void> {
  const { videoId, storageKey } = event.data;

  // Infra failures (storage unreachable, etc.) bubble up so the consumer's
  // retry/DLQ machinery handles them; only ffprobe's verdict on the file
  // itself is treated as a business outcome.
  const url = await deps.presignGet(storageKey);

  let result: ProbeResult;
  try {
    result = await deps.probe(url);
  } catch (error) {
    const failed: VideoValidationFailed = {
      eventId: randomUUID(),
      eventType: "video.validation.failed",
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      correlationId: event.correlationId,
      data: {
        videoId,
        reason: error instanceof Error ? error.message : String(error),
      },
    };
    deps.publisher.publish(EXCHANGES.videoEvents, ROUTING_KEYS.videoValidationFailed, failed);
    return;
  }

  const validated: VideoValidated = {
    eventId: randomUUID(),
    eventType: "video.validated",
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    correlationId: event.correlationId,
    data: {
      videoId,
      durationSec: result.durationSec,
      format: result.format,
      storageKey,
    },
  };
  deps.publisher.publish(EXCHANGES.videoEvents, ROUTING_KEYS.videoValidated, validated);
}
