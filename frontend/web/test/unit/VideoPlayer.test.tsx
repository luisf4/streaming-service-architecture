import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const instances: FakeHls[] = [];

class FakeHls {
  static isSupported = vi.fn().mockReturnValue(true);
  static Events = { MANIFEST_PARSED: "hlsManifestParsed", ERROR: "hlsError" };

  handlers: Record<string, (event: string, data: unknown) => void> = {};
  loadSource = vi.fn();
  attachMedia = vi.fn();
  destroy = vi.fn();
  currentLevel = -1;

  constructor() {
    instances.push(this);
  }

  on(event: string, handler: (event: string, data: unknown) => void): void {
    this.handlers[event] = handler;
  }

  emit(event: string, data: unknown): void {
    this.handlers[event]?.(event, data);
  }
}

vi.mock("hls.js", () => ({ default: FakeHls }));

// Imported after the mock so the component picks up FakeHls.
const { VideoPlayer } = await import("../../src/components/VideoPlayer");

describe("VideoPlayer", () => {
  beforeEach(() => {
    instances.length = 0;
    FakeHls.isSupported.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("attaches hls.js to the video element and loads the manifest", () => {
    render(<VideoPlayer manifestUrl="https://example.test/master.m3u8" />);

    expect(instances).toHaveLength(1);
    expect(instances[0].loadSource).toHaveBeenCalledWith("https://example.test/master.m3u8");
    expect(instances[0].attachMedia).toHaveBeenCalledWith(screen.getByTestId("video-player"));
  });

  it("destroys the hls.js instance on unmount", () => {
    const { unmount } = render(<VideoPlayer manifestUrl="https://example.test/master.m3u8" />);
    const instance = instances[0];

    unmount();

    expect(instance.destroy).toHaveBeenCalledTimes(1);
  });

  it("shows a quality selector once the manifest is parsed, and switches level on change", async () => {
    const user = userEvent.setup();
    render(<VideoPlayer manifestUrl="https://example.test/master.m3u8" />);
    const instance = instances[0];

    act(() => {
      instance.emit(FakeHls.Events.MANIFEST_PARSED, {
        levels: [{ height: 360 }, { height: 720 }],
      });
    });

    const select = await screen.findByLabelText("Quality");
    expect(screen.getByRole("option", { name: "360p" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "720p" })).toBeInTheDocument();

    await user.selectOptions(select, "1");

    expect(instance.currentLevel).toBe(1);
  });

  it("shows an alert when hls.js reports a fatal error", () => {
    render(<VideoPlayer manifestUrl="https://example.test/master.m3u8" />);
    const instance = instances[0];

    act(() => {
      instance.emit(FakeHls.Events.ERROR, { fatal: true, details: "manifestLoadError" });
    });

    expect(screen.getByRole("alert")).toHaveTextContent("manifestLoadError");
  });

  it("ignores non-fatal hls.js errors", () => {
    render(<VideoPlayer manifestUrl="https://example.test/master.m3u8" />);
    const instance = instances[0];

    act(() => {
      instance.emit(FakeHls.Events.ERROR, { fatal: false, details: "bufferStalledError" });
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
