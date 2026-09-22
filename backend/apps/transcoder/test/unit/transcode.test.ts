import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildFfmpegArgs, transcodeChunk } from "../../src/transcode";

const execFileAsync = promisify(execFile);
const FIXTURE = path.resolve(__dirname, "../fixtures/sample-long.mp4");

describe("buildFfmpegArgs", () => {
  it("scales to the target resolution's height and keeps width auto (even)", () => {
    const args = buildFfmpegArgs({
      inputUrl: "https://example.test/source.mp4",
      startSec: 2,
      durationSec: 2,
      resolution: "360p",
      outputPath: "/tmp/out.ts",
    });

    expect(args).toContain("-vf");
    expect(args[args.indexOf("-vf") + 1]).toBe("scale=-2:360");
    expect(args).toContain("-ss");
    expect(args[args.indexOf("-ss") + 1]).toBe("2");
    expect(args).toContain("-t");
    expect(args[args.indexOf("-t") + 1]).toBe("2");
    expect(args.at(-1)).toBe("/tmp/out.ts");
  });
});

describe("transcodeChunk (real ffmpeg)", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(os.tmpdir(), "transcoder-test-"));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("trims and re-encodes a chunk of the source to the target resolution", async () => {
    const outputPath = path.join(workDir, "segment.ts");

    await transcodeChunk({
      inputUrl: FIXTURE,
      startSec: 2,
      durationSec: 2,
      resolution: "360p",
      outputPath,
    });

    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=height",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      outputPath,
    ]);
    const probed = JSON.parse(stdout) as { streams: { height: number }[]; format: { duration: string } };

    expect(probed.streams[0].height).toBe(360);
    expect(Number(probed.format.duration)).toBeGreaterThan(1.5);
    expect(Number(probed.format.duration)).toBeLessThan(2.5);
  });
});
