import { describe, expect, it } from "vitest";
import { planChunks } from "../../src/chunk-plan";

describe("planChunks", () => {
  it("splits into keyframe-aligned chunks close to the target duration", () => {
    const chunks = planChunks([0, 1, 2, 3, 4], 5, 2);

    expect(chunks).toEqual([
      { sequence: 0, startSec: 0, durationSec: 2 },
      { sequence: 1, startSec: 2, durationSec: 2 },
      { sequence: 2, startSec: 4, durationSec: 1 },
    ]);
  });

  it("merges a trailing sliver shorter than minChunkSec into the previous chunk", () => {
    const chunks = planChunks([0, 2, 4], 4.2, 2);

    expect(chunks).toEqual([
      { sequence: 0, startSec: 0, durationSec: 2 },
      { sequence: 1, startSec: 2, durationSec: 2.2 },
    ]);
  });

  it("keeps a trailing chunk that is not too short", () => {
    const chunks = planChunks([0, 2, 4], 4.8, 2, { minChunkSec: 0.5 });

    expect(chunks).toEqual([
      { sequence: 0, startSec: 0, durationSec: 2 },
      { sequence: 1, startSec: 2, durationSec: 2 },
      { sequence: 2, startSec: 4, durationSec: 0.8 },
    ]);
  });

  it("produces a single chunk when the whole video is shorter than the target", () => {
    const chunks = planChunks([0], 1.5, 2);

    expect(chunks).toEqual([{ sequence: 0, startSec: 0, durationSec: 1.5 }]);
  });

  it("skips keyframes at or after the total duration", () => {
    const chunks = planChunks([0, 2, 5], 5, 2);

    expect(chunks).toEqual([
      { sequence: 0, startSec: 0, durationSec: 2 },
      { sequence: 1, startSec: 2, durationSec: 3 },
    ]);
  });

  it("advances past several target multiples when keyframes are sparse", () => {
    const chunks = planChunks([0, 9], 10, 2);

    expect(chunks).toEqual([
      { sequence: 0, startSec: 0, durationSec: 9 },
      { sequence: 1, startSec: 9, durationSec: 1 },
    ]);
  });

  it("rejects a non-positive targetChunkSec", () => {
    expect(() => planChunks([0], 5, 0)).toThrow(/targetChunkSec/);
  });

  it("rejects a non-positive durationSec", () => {
    expect(() => planChunks([0], 0, 2)).toThrow(/durationSec/);
  });
});
