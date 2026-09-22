import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { parseEvent, UnknownEventTypeError } from "../src/registry";

function envelope(eventType: string, eventVersion: number, data: unknown) {
  return {
    eventId: randomUUID(),
    eventType,
    eventVersion,
    occurredAt: new Date().toISOString(),
    correlationId: randomUUID(),
    data,
  };
}

describe("parseEvent", () => {
  it("dispatches to the right schema based on eventType", () => {
    const parsed = parseEvent(
      envelope("video.ready", 1, {
        videoId: randomUUID(),
        manifestKey: "hls/abc/master.m3u8",
      }),
    );
    expect(parsed.eventType).toBe("video.ready");
  });

  it("throws UnknownEventTypeError for an unregistered eventType", () => {
    expect(() => parseEvent(envelope("video.mystery", 1, {}))).toThrow(
      UnknownEventTypeError,
    );
  });

  it("throws when eventType is missing", () => {
    const payload = envelope("video.ready", 1, { videoId: randomUUID(), manifestKey: "x" });
    // @ts-expect-error intentional
    delete payload.eventType;
    expect(() => parseEvent(payload)).toThrow(UnknownEventTypeError);
  });

  it("still validates the data payload for a known eventType", () => {
    expect(() =>
      parseEvent(envelope("video.ready", 1, { videoId: "not-a-uuid" })),
    ).toThrow();
  });
});
