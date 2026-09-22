import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { VideoUploaded } from "../src/events/video-uploaded";

function validPayload() {
  return {
    eventId: randomUUID(),
    eventType: "video.uploaded" as const,
    eventVersion: 1 as const,
    occurredAt: new Date().toISOString(),
    correlationId: randomUUID(),
    data: {
      videoId: randomUUID(),
      storageKey: "raw/abc.mp4",
      sizeBytes: 1024,
      originalFilename: "abc.mp4",
    },
  };
}

describe("event envelope", () => {
  it("parses a valid event", () => {
    const result = VideoUploaded.parse(validPayload());
    expect(result.eventType).toBe("video.uploaded");
    expect(result.eventVersion).toBe(1);
  });

  it("rejects a payload with the wrong eventType", () => {
    const payload = { ...validPayload(), eventType: "video.other" };
    expect(() => VideoUploaded.parse(payload)).toThrow();
  });

  it("rejects a payload with a non-uuid correlationId", () => {
    const payload = { ...validPayload(), correlationId: "not-a-uuid" };
    expect(() => VideoUploaded.parse(payload)).toThrow();
  });

  it("rejects a payload missing required data fields", () => {
    const payload = validPayload();
    // @ts-expect-error intentionally incomplete for the test
    delete payload.data.sizeBytes;
    expect(() => VideoUploaded.parse(payload)).toThrow();
  });

  it("rejects the wrong eventVersion", () => {
    const payload = { ...validPayload(), eventVersion: 2 };
    expect(() => VideoUploaded.parse(payload)).toThrow();
  });
});
