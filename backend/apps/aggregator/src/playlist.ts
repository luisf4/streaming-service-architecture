import path from "node:path";
import type { Resolution } from "@video-streaming/contracts";

export interface SegmentInfo {
  sequence: number;
  segmentDuration: number;
  segmentKey: string;
}

/**
 * Builds the per-resolution VOD playlist. Segments come from independent
 * ffmpeg encodes (one per chunk), so every splice after the first gets
 * #EXT-X-DISCONTINUITY - see the dispatcher's chunk-splice spike for why
 * that tag is required for a clean, gapless playback across segments.
 */
export function buildResolutionPlaylist(segments: SegmentInfo[]): string {
  const sorted = [...segments].sort((a, b) => a.sequence - b.sequence);
  const targetDuration = Math.max(1, ...sorted.map((s) => Math.ceil(s.segmentDuration)));

  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-PLAYLIST-TYPE:VOD",
  ];

  sorted.forEach((segment, index) => {
    if (index > 0) {
      lines.push("#EXT-X-DISCONTINUITY");
    }
    lines.push(`#EXTINF:${segment.segmentDuration.toFixed(6)},`);
    lines.push(path.basename(segment.segmentKey));
  });

  lines.push("#EXT-X-ENDLIST", "");
  return lines.join("\n");
}

const BANDWIDTH_BPS: Record<Resolution, number> = {
  "240p": 400_000,
  "360p": 800_000,
  "480p": 1_400_000,
  "720p": 2_800_000,
  "1080p": 5_000_000,
};

const DIMENSIONS: Record<Resolution, string> = {
  "240p": "426x240",
  "360p": "640x360",
  "480p": "854x480",
  "720p": "1280x720",
  "1080p": "1920x1080",
};

/** Master playlist referencing each resolution's own playlist.m3u8, one directory per resolution. */
export function buildMasterPlaylist(resolutions: Resolution[]): string {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];

  for (const resolution of [...resolutions].sort((a, b) => BANDWIDTH_BPS[a] - BANDWIDTH_BPS[b])) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${BANDWIDTH_BPS[resolution]},RESOLUTION=${DIMENSIONS[resolution]}`);
    lines.push(`${resolution}/playlist.m3u8`);
  }

  lines.push("");
  return lines.join("\n");
}
