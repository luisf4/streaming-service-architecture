export interface ChunkPlanEntry {
  sequence: number;
  startSec: number;
  durationSec: number;
}

export interface PlanChunksOptions {
  /** A trailing chunk shorter than this gets merged into the previous one instead of standing alone. Defaults to half the target chunk length. */
  minChunkSec?: number;
}

/**
 * Picks chunk boundaries that land exactly on keyframes at or after each
 * multiple of `targetChunkSec`, so every chunk can be extracted (and later
 * transcoded) independently without decoding into an earlier GOP.
 */
export function planChunks(
  keyframeTimestamps: number[],
  durationSec: number,
  targetChunkSec: number,
  options: PlanChunksOptions = {},
): ChunkPlanEntry[] {
  if (targetChunkSec <= 0) {
    throw new Error("targetChunkSec must be positive");
  }
  if (durationSec <= 0) {
    throw new Error("durationSec must be positive");
  }

  const minChunkSec = options.minChunkSec ?? targetChunkSec / 2;
  const sorted = [...keyframeTimestamps].sort((a, b) => a - b);

  const boundaries: number[] = [0];
  let nextTarget = targetChunkSec;

  for (const ts of sorted) {
    if (ts <= boundaries[boundaries.length - 1]) continue;
    if (ts >= durationSec) break;
    if (ts >= nextTarget) {
      boundaries.push(ts);
      while (nextTarget <= ts) nextTarget += targetChunkSec;
    }
  }

  boundaries.push(durationSec);

  if (boundaries.length > 2) {
    const last = boundaries[boundaries.length - 1];
    const secondLast = boundaries[boundaries.length - 2];
    if (last - secondLast < minChunkSec) {
      boundaries.splice(boundaries.length - 2, 1);
    }
  }

  const chunks: ChunkPlanEntry[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    chunks.push({
      sequence: i,
      startSec: round(boundaries[i]),
      durationSec: round(boundaries[i + 1] - boundaries[i]),
    });
  }
  return chunks;
}

// ffprobe timestamps are floats; round to millisecond precision so chunk
// math (subtraction) doesn't leak binary floating-point noise.
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
