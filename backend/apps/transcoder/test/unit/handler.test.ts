import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TranscodeRequested } from "@video-streaming/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleTranscodeRequested, segmentKey } from "../../src/handler";

function requestedEvent(): TranscodeRequested {
  return {
    eventId: randomUUID(),
    eventType: "transcode.requested",
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    correlationId: randomUUID(),
    data: {
      videoId: randomUUID(),
      chunkId: randomUUID(),
      sequence: 3,
      resolution: "360p",
      sourceKey: "videos/v1/original",
      startSec: 6,
      durationSec: 2,
    },
  };
}

describe("segmentKey", () => {
  it("zero-pads the sequence so segments sort lexicographically", () => {
    expect(segmentKey("v1", "360p", 3)).toBe("videos/v1/360p/segment-00003.ts");
  });
});

describe("handleTranscodeRequested", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(os.tmpdir(), "transcoder-handler-test-"));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("transcodes, uploads the segment and publishes chunk.transcoded", async () => {
    const event = requestedEvent();
    const publish = vi.fn();
    const presignGet = vi.fn().mockResolvedValue("https://example.test/presigned");
    const putObject = vi.fn().mockResolvedValue(undefined);
    const transcode = vi.fn().mockImplementation(async ({ outputPath }: { outputPath: string }) => {
      await writeFile(outputPath, "fake-ts-bytes");
    });

    await handleTranscodeRequested(event, {
      publisher: { publish },
      presignGet,
      putObject,
      transcode,
      tmpDir: workDir,
    });

    expect(presignGet).toHaveBeenCalledWith(event.data.sourceKey);
    expect(transcode).toHaveBeenCalledWith(
      expect.objectContaining({
        inputUrl: "https://example.test/presigned",
        startSec: 6,
        durationSec: 2,
        resolution: "360p",
      }),
    );

    const expectedKey = segmentKey(event.data.videoId, "360p", 3);
    expect(putObject).toHaveBeenCalledWith(expectedKey, Buffer.from("fake-ts-bytes"));

    expect(publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, payload] = publish.mock.calls[0];
    expect(exchange).toBe("video.events");
    expect(routingKey).toBe("chunk.transcoded");
    expect(payload).toMatchObject({
      eventType: "chunk.transcoded",
      correlationId: event.correlationId,
      data: {
        videoId: event.data.videoId,
        chunkId: event.data.chunkId,
        sequence: 3,
        resolution: "360p",
        segmentKey: expectedKey,
        segmentDurationSec: 2,
      },
    });
  });

  it("cleans up the temp output file even when the handler fails", async () => {
    const event = requestedEvent();
    let capturedOutputPath = "";
    const transcode = vi.fn().mockImplementation(async ({ outputPath }: { outputPath: string }) => {
      capturedOutputPath = outputPath;
      await writeFile(outputPath, "fake-ts-bytes");
    });
    const putObject = vi.fn().mockRejectedValue(new Error("upload failed"));

    await expect(
      handleTranscodeRequested(event, {
        publisher: { publish: vi.fn() },
        presignGet: vi.fn().mockResolvedValue("https://example.test/presigned"),
        putObject,
        transcode,
        tmpDir: workDir,
      }),
    ).rejects.toThrow("upload failed");

    await expect(readFile(capturedOutputPath)).rejects.toThrow();
  });
});
