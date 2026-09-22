import { randomUUID } from "node:crypto";
import type { VideoUploaded } from "@video-streaming/contracts";
import { describe, expect, it, vi } from "vitest";
import { handleVideoUploaded } from "../../src/handler";

function uploadedEvent(): VideoUploaded {
  return {
    eventId: randomUUID(),
    eventType: "video.uploaded",
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    correlationId: randomUUID(),
    data: {
      videoId: randomUUID(),
      storageKey: "videos/v1/original",
      sizeBytes: 1024,
      originalFilename: "a.mp4",
    },
  };
}

describe("handleVideoUploaded", () => {
  it("publishes video.validated with the probe result and the same correlationId", async () => {
    const event = uploadedEvent();
    const publish = vi.fn();
    const presignGet = vi.fn().mockResolvedValue("https://example.test/presigned");
    const probe = vi.fn().mockResolvedValue({ durationSec: 12.5, format: "mov" });

    await handleVideoUploaded(event, { publisher: { publish }, probe, presignGet });

    expect(presignGet).toHaveBeenCalledWith(event.data.storageKey);
    expect(probe).toHaveBeenCalledWith("https://example.test/presigned");
    expect(publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, payload] = publish.mock.calls[0];
    expect(exchange).toBe("video.events");
    expect(routingKey).toBe("video.validated");
    expect(payload).toMatchObject({
      eventType: "video.validated",
      correlationId: event.correlationId,
      data: {
        videoId: event.data.videoId,
        durationSec: 12.5,
        format: "mov",
        storageKey: event.data.storageKey,
      },
    });
  });

  it("publishes video.validation.failed with the probe error reason when the file is invalid", async () => {
    const event = uploadedEvent();
    const publish = vi.fn();
    const presignGet = vi.fn().mockResolvedValue("https://example.test/presigned");
    const probe = vi.fn().mockRejectedValue(new Error("no video stream found in the uploaded file"));

    await handleVideoUploaded(event, { publisher: { publish }, probe, presignGet });

    expect(publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, payload] = publish.mock.calls[0];
    expect(exchange).toBe("video.events");
    expect(routingKey).toBe("video.validation.failed");
    expect(payload).toMatchObject({
      eventType: "video.validation.failed",
      correlationId: event.correlationId,
      data: {
        videoId: event.data.videoId,
        reason: "no video stream found in the uploaded file",
      },
    });
  });

  it("lets presign (infra) errors bubble up instead of turning them into a validation.failed event", async () => {
    const event = uploadedEvent();
    const publish = vi.fn();
    const presignGet = vi.fn().mockRejectedValue(new Error("storage unreachable"));
    const probe = vi.fn();

    await expect(handleVideoUploaded(event, { publisher: { publish }, probe, presignGet })).rejects.toThrow(
      "storage unreachable",
    );
    expect(probe).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
