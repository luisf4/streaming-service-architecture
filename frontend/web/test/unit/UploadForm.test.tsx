import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadForm } from "../../src/components/UploadForm";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  close = vi.fn();
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("UploadForm", () => {
  beforeEach(() => {
    FakeEventSource.instances.length = 0;
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads the selected file part by part and shows the live status once done", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/videos") && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({ videoId: "v1", uploadId: "u1", bucket: "raw", key: "videos/v1/original" }),
        );
      }
      if (url.includes("/parts/") && url.includes("/presign")) {
        return Promise.resolve(jsonResponse({ url: "https://example.test/put-part-1" }));
      }
      if (url === "https://example.test/put-part-1") {
        return Promise.resolve(new Response(null, { status: 200, headers: { etag: '"e1"' } }));
      }
      if (url.endsWith("/v1/complete")) {
        return Promise.resolve(jsonResponse({ id: "v1", status: "UPLOADED" }));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UploadForm />);

    await user.type(screen.getByLabelText("Title"), "My video");
    const file = new File([new Uint8Array(1024)], "clip.mp4", { type: "video/mp4" });
    await user.upload(screen.getByLabelText("Video file"), file);
    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => expect(screen.getByText("Waiting for status...")).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/videos"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toContain("/videos/v1/events");
  });

  it("shows an error message when the upload fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));

    render(<UploadForm />);

    await user.type(screen.getByLabelText("Title"), "My video");
    const file = new File([new Uint8Array(1024)], "clip.mp4", { type: "video/mp4" });
    await user.upload(screen.getByLabelText("Video file"), file);
    await user.click(screen.getByRole("button", { name: /upload/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/500/);
  });
});
