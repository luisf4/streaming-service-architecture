import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ProbeResult {
  durationSec: number;
  format: string;
}

interface FfprobeStream {
  codec_type?: string;
}

interface FfprobeOutput {
  format?: {
    duration?: string;
    format_name?: string;
  };
  streams?: FfprobeStream[];
}

export async function probeVideo(input: string, ffprobePath = "ffprobe"): Promise<ProbeResult> {
  const { stdout } = await execFileAsync(ffprobePath, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    input,
  ]);

  const parsed = JSON.parse(stdout) as FfprobeOutput;

  if (!parsed.format?.duration || !parsed.format.format_name) {
    throw new Error("ffprobe returned no usable format information");
  }

  const hasVideoStream = (parsed.streams ?? []).some((stream) => stream.codec_type === "video");
  if (!hasVideoStream) {
    throw new Error("no video stream found in the uploaded file");
  }

  const durationSec = Number(parsed.format.duration);
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error("ffprobe reported an invalid duration");
  }

  return {
    durationSec,
    format: parsed.format.format_name.split(",")[0],
  };
}
