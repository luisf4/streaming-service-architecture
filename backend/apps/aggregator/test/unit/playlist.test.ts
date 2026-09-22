import { describe, expect, it } from "vitest";
import { buildMasterPlaylist, buildResolutionPlaylist } from "../../src/playlist";

describe("buildResolutionPlaylist", () => {
  it("lists segments in sequence order with a discontinuity between each independent encode", () => {
    const playlist = buildResolutionPlaylist([
      { sequence: 1, segmentDuration: 2, segmentKey: "videos/v1/360p/segment-00001.ts" },
      { sequence: 0, segmentDuration: 2, segmentKey: "videos/v1/360p/segment-00000.ts" },
      { sequence: 2, segmentDuration: 1, segmentKey: "videos/v1/360p/segment-00002.ts" },
    ]);

    const lines = playlist.split("\n");
    expect(lines).toContain("#EXTM3U");
    expect(lines).toContain("#EXT-X-ENDLIST");
    expect(lines.filter((l) => l === "#EXT-X-DISCONTINUITY")).toHaveLength(2);

    const segmentIndex = lines.indexOf("segment-00000.ts");
    expect(segmentIndex).toBeGreaterThan(-1);
    expect(lines.indexOf("segment-00001.ts")).toBeGreaterThan(segmentIndex);
    expect(lines.indexOf("segment-00002.ts")).toBeGreaterThan(lines.indexOf("segment-00001.ts"));
  });

  it("sets the target duration to the longest segment, rounded up", () => {
    const playlist = buildResolutionPlaylist([
      { sequence: 0, segmentDuration: 5.9, segmentKey: "s0.ts" },
      { sequence: 1, segmentDuration: 2.1, segmentKey: "s1.ts" },
    ]);

    expect(playlist).toContain("#EXT-X-TARGETDURATION:6");
  });

  it("does not emit a discontinuity before the first segment", () => {
    const playlist = buildResolutionPlaylist([{ sequence: 0, segmentDuration: 2, segmentKey: "s0.ts" }]);

    expect(playlist).not.toContain("#EXT-X-DISCONTINUITY");
  });
});

describe("buildMasterPlaylist", () => {
  it("references each resolution's own playlist, ordered from lowest to highest bandwidth", () => {
    const master = buildMasterPlaylist(["720p", "360p"]);
    const lines = master.split("\n");

    const idx360 = lines.indexOf("360p/playlist.m3u8");
    const idx720 = lines.indexOf("720p/playlist.m3u8");
    expect(idx360).toBeGreaterThan(-1);
    expect(idx720).toBeGreaterThan(idx360);
    expect(lines[idx360 - 1]).toContain("BANDWIDTH=800000");
    expect(lines[idx720 - 1]).toContain("BANDWIDTH=2800000");
  });
});
