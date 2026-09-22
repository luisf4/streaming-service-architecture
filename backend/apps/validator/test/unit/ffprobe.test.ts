import path from "node:path";
import { describe, expect, it } from "vitest";
import { probeVideo } from "../../src/ffprobe";

const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("probeVideo (real ffprobe)", () => {
  it("reports duration and container format for a valid mp4", async () => {
    const result = await probeVideo(path.join(FIXTURES, "sample.mp4"));

    expect(result.format).toBe("mov");
    expect(result.durationSec).toBeGreaterThan(0.5);
    expect(result.durationSec).toBeLessThan(2);
  });

  it("throws when the file has no video stream", async () => {
    await expect(probeVideo(path.join(FIXTURES, "not-a-video.txt"))).rejects.toThrow();
  });

  it("throws when the file does not exist", async () => {
    await expect(probeVideo(path.join(FIXTURES, "missing.mp4"))).rejects.toThrow();
  });
});
