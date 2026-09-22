import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Resolution } from "@video-streaming/contracts";

const execFileAsync = promisify(execFile);

export const RESOLUTION_HEIGHT: Record<Resolution, number> = {
  "240p": 240,
  "360p": 360,
  "480p": 480,
  "720p": 720,
  "1080p": 1080,
};

export interface TranscodeOptions {
  inputUrl: string;
  startSec: number;
  durationSec: number;
  resolution: Resolution;
  outputPath: string;
  ffmpegPath?: string;
}

/**
 * Independently trims [startSec, startSec+durationSec) out of the source and
 * re-encodes it to the target resolution as a standalone MPEG-TS segment.
 * `startSec` must land on a source keyframe (the dispatcher guarantees this)
 * so the trim is frame-accurate. See dispatcher's chunk-splice spike for why
 * segments produced this way need #EXT-X-DISCONTINUITY when reassembled.
 */
export function buildFfmpegArgs(options: TranscodeOptions): string[] {
  const height = RESOLUTION_HEIGHT[options.resolution];
  return [
    "-y",
    "-ss",
    String(options.startSec),
    "-t",
    String(options.durationSec),
    "-i",
    options.inputUrl,
    "-vf",
    `scale=-2:${height}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-avoid_negative_ts",
    "make_zero",
    "-f",
    "mpegts",
    options.outputPath,
  ];
}

export async function transcodeChunk(options: TranscodeOptions): Promise<void> {
  await execFileAsync(options.ffmpegPath ?? "ffmpeg", buildFfmpegArgs(options));
}
