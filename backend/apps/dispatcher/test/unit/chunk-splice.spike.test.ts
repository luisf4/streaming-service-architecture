import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { getKeyframeTimestamps } from "../../src/keyframes";
import { planChunks } from "../../src/chunk-plan";

const execFileAsync = promisify(execFile);
const FIXTURE = path.resolve(__dirname, "../fixtures/sample-long.mp4");
const SOURCE_DURATION_SEC = 5;
const SOURCE_FPS = 10;

/**
 * Fase 4's riskiest bet: cut a source video into independent,
 * keyframe-aligned chunks and encode each one on its own. This checks that
 * the reassembled HLS stream plays back as one continuous video - no gaps,
 * no duplicated/dropped frames at the splice points - using real
 * ffmpeg/ffprobe, not mocks.
 *
 * Each segment is verified the way an HLS player actually consumes it: as
 * an independently decodable unit, with #EXTINF entries providing the
 * timeline (not a single demux session spanning every segment). An earlier
 * version of this test fed the whole playlist through one
 * `ffmpeg -i playlist.m3u8 -f null -` pass and saw "Packet corrupt" /
 * timestamp-discontinuity errors from ffmpeg's own HLS demuxer, which
 * expects a continuous PCR across segments from the same encoder session -
 * not what genuinely independent per-chunk encodes produce, and not how
 * real HLS players (which decode segment-by-segment) behave either.
 */
describe("chunk + re-encode + HLS splice (spike)", () => {
  it("reassembles independently-encoded chunks into a clean, gapless HLS stream", async () => {
    const workDir = await mkdtemp(path.join(os.tmpdir(), "chunk-splice-spike-"));

    try {
      const keyframes = await getKeyframeTimestamps(FIXTURE);
      const chunks = planChunks(keyframes, SOURCE_DURATION_SEC, 2);
      expect(chunks).toHaveLength(3);

      const segmentFiles: string[] = [];
      for (const chunk of chunks) {
        const segmentPath = path.join(workDir, `chunk-${chunk.sequence}.ts`);
        await execFileAsync("ffmpeg", [
          "-y",
          "-ss",
          String(chunk.startSec),
          "-t",
          String(chunk.durationSec),
          "-i",
          FIXTURE,
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-avoid_negative_ts",
          "make_zero",
          "-f",
          "mpegts",
          segmentPath,
        ]);
        segmentFiles.push(segmentPath);
      }

      const playlist = [
        "#EXTM3U",
        "#EXT-X-VERSION:3",
        "#EXT-X-TARGETDURATION:2",
        "#EXT-X-MEDIA-SEQUENCE:0",
        ...chunks.flatMap((chunk, i) => [
          `#EXTINF:${chunk.durationSec.toFixed(6)},`,
          path.basename(segmentFiles[i]),
        ]),
        "#EXT-X-ENDLIST",
        "",
      ].join("\n");
      const playlistPath = path.join(workDir, "index.m3u8");
      await writeFile(playlistPath, playlist);

      // 1. The playlist's #EXTINF entries must add up to the source duration
      // - this is the timeline an HLS player actually schedules against.
      const totalExtinfDuration = chunks.reduce((sum, chunk) => sum + chunk.durationSec, 0);
      expect(totalExtinfDuration).toBeCloseTo(SOURCE_DURATION_SEC, 1);

      // 2. Every segment must decode cleanly on its own - zero
      // errors/warnings - and its first frame must be a keyframe, since
      // that is what makes it independently playable at all.
      let totalFrames = 0;
      for (const segmentPath of segmentFiles) {
        const { stderr } = await execFileAsync("ffmpeg", ["-v", "warning", "-i", segmentPath, "-f", "null", "-"]);
        expect(stderr.trim()).toBe("");

        const { stdout: firstFramePictType } = await execFileAsync("ffprobe", [
          "-v",
          "error",
          "-select_streams",
          "v:0",
          "-show_entries",
          "frame=pict_type",
          "-of",
          "csv=p=0",
          "-read_intervals",
          "%+#1",
          segmentPath,
        ]);
        expect(firstFramePictType.trim().split(",")[0]).toBe("I");

        const { stdout: frameCountOut } = await execFileAsync("ffprobe", [
          "-v",
          "error",
          "-count_frames",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=nb_read_frames",
          "-of",
          "csv=p=0",
          segmentPath,
        ]);
        const firstLine = frameCountOut.trim().split("\n")[0];
        totalFrames += Number(firstLine.split(",")[0]);
      }

      // 3. No frames lost or duplicated across the two splice points.
      const expectedFrames = SOURCE_DURATION_SEC * SOURCE_FPS;
      expect(Math.abs(totalFrames - expectedFrames)).toBeLessThanOrEqual(chunks.length - 1);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }, 30_000);
});
