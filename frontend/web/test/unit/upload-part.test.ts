import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadPartToPresignedUrl } from "../../src/lib/upload";

describe("uploadPartToPresignedUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PUTs the chunk and returns the unquoted ETag", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200, headers: { etag: '"abc123"' } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const etag = await uploadPartToPresignedUrl("https://example.test/part-1", new Blob(["data"]));

    expect(fetchMock).toHaveBeenCalledWith("https://example.test/part-1", {
      method: "PUT",
      body: expect.any(Blob),
    });
    expect(etag).toBe("abc123");
  });

  it("throws when the upload response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(uploadPartToPresignedUrl("https://example.test/part-1", new Blob(["data"]))).rejects.toThrow(
      /500/,
    );
  });

  it("throws when the response has no ETag header", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

    await expect(uploadPartToPresignedUrl("https://example.test/part-1", new Blob(["data"]))).rejects.toThrow(
      /ETag/,
    );
  });
});
