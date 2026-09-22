import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Timestamps (seconds, ascending) of every keyframe in the video's first
 * stream. Chunk boundaries must land exactly on one of these so a chunk can
 * be trimmed with a stream copy (or an independent re-encode) without
 * needing to decode from an earlier GOP.
 */
export async function getKeyframeTimestamps(input: string, ffprobePath = "ffprobe"): Promise<number[]> {
  const { stdout } = await execFileAsync(ffprobePath, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-skip_frame",
    "nokey",
    "-show_entries",
    "frame=pts_time",
    "-of",
    "csv=p=0",
    input,
  ]);

  const timestamps = stdout
    .split("\n")
    .map((line) => line.trim().split(",")[0])
    .filter((value) => value.length > 0)
    .map(Number)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (timestamps.length === 0) {
    throw new Error(`no keyframes found in ${input}`);
  }

  return timestamps;
}
