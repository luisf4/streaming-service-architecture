import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoList } from "../../src/components/VideoList";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("VideoList", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an empty state when there are no videos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    render(<VideoList />);

    expect(await screen.findByText(/no videos yet/i)).toBeInTheDocument();
  });

  it("lists videos, linking only the ready ones to the player", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse([
          {
            id: "v1",
            title: "Ready clip",
            status: "READY",
            durationSec: 65,
            createdAt: "2026-01-01T00:00:00Z",
          },
          {
            id: "v2",
            title: "Still cooking",
            status: "PROCESSING",
            durationSec: null,
            createdAt: "2026-01-02T00:00:00Z",
          },
        ]),
      ),
    );

    render(<VideoList />);

    const readyLink = await screen.findByRole("link", { name: "Ready clip" });
    expect(readyLink).toHaveAttribute("href", "/videos/v1");
    expect(screen.getByText("Still cooking")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Still cooking" })).not.toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));

    render(<VideoList />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/500/);
  });
});
