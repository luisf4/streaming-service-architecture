import path from "node:path";
import { describe, expect, it } from "vitest";
import { getKeyframeTimestamps } from "../../src/keyframes";

const FIXTURE = path.resolve(__dirname, "../fixtures/sample-long.mp4");

describe("getKeyframeTimestamps (real ffprobe)", () => {
  it("finds every keyframe (one per second, forced via -g 10 at 10fps)", async () => {
    const timestamps = await getKeyframeTimestamps(FIXTURE);

    expect(timestamps).toEqual([0, 1, 2, 3, 4]);
  });

  it("throws for a file with no video stream", async () => {
    await expect(getKeyframeTimestamps(path.resolve(__dirname, "../fixtures/does-not-exist.mp4"))).rejects.toThrow();
  });
});
