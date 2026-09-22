import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerPage } from "../../src/components/PlayerPage";

vi.mock("hls.js", () => ({
  default: class {
    static isSupported = () => false;
  },
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("PlayerPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the player once the presigned manifest URL resolves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ manifestUrl: "https://example.test/master.m3u8", expiresInSec: 3600 })),
    );

    render(<PlayerPage videoId="v1" />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(await screen.findByTestId("video-player")).toBeInTheDocument();
  });

  it("shows an error when the video is not ready yet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not ready", { status: 409 })));

    render(<PlayerPage videoId="v1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/409/);
  });
});
