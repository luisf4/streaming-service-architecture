import { describe, expect, it, vi } from "vitest";
import { uploadVideo, type UploadDeps } from "../../src/lib/upload";

function fakeFile(sizeBytes: number, name = "video.mp4"): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: "video/mp4" });
}

function fakeDeps(overrides: Partial<UploadDeps> = {}): UploadDeps {
  return {
    startUpload: vi.fn().mockResolvedValue({ videoId: "v1", uploadId: "u1", bucket: "raw", key: "videos/v1/original" }),
    presignPart: vi.fn().mockImplementation((_v, _u, partNumber) =>
      Promise.resolve({ url: `https://example.test/part-${partNumber}` }),
    ),
    uploadPart: vi.fn().mockImplementation((url) => Promise.resolve(`etag-for-${url}`)),
    completeUpload: vi.fn().mockResolvedValue({ id: "v1", status: "UPLOADED" }),
    ...overrides,
  } as UploadDeps;
}

describe("uploadVideo", () => {
  it("splits the file into parts of the given size and uploads each one", async () => {
    const file = fakeFile(10 * 1024 * 1024); // 10 MiB
    const deps = fakeDeps();

    await uploadVideo(file, { title: "My video" }, deps, undefined, 4 * 1024 * 1024);

    expect(deps.startUpload).toHaveBeenCalledWith({
      title: "My video",
      description: undefined,
      originalFilename: "video.mp4",
      contentType: "video/mp4",
      sizeBytes: 10 * 1024 * 1024,
    });

    // 10 MiB at 4 MiB per part -> 3 parts (4, 4, 2)
    expect(deps.presignPart).toHaveBeenCalledTimes(3);
    expect(deps.presignPart).toHaveBeenNthCalledWith(1, "v1", "u1", 1);
    expect(deps.presignPart).toHaveBeenNthCalledWith(3, "v1", "u1", 3);
    expect(deps.uploadPart).toHaveBeenCalledTimes(3);
  });

  it("uploads a file smaller than one part as a single part", async () => {
    const file = fakeFile(1024);
    const deps = fakeDeps();

    await uploadVideo(file, { title: "Tiny" }, deps);

    expect(deps.presignPart).toHaveBeenCalledTimes(1);
    expect(deps.uploadPart).toHaveBeenCalledTimes(1);
  });

  it("reports progress after each part and completes with all part ETags in order", async () => {
    const file = fakeFile(10 * 1024 * 1024);
    const deps = fakeDeps();
    const onProgress = vi.fn();

    await uploadVideo(file, { title: "My video" }, deps, onProgress, 4 * 1024 * 1024);

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      uploadedBytes: 4 * 1024 * 1024,
      totalBytes: 10 * 1024 * 1024,
      partsDone: 1,
      totalParts: 3,
    });
    expect(onProgress).toHaveBeenNthCalledWith(3, {
      uploadedBytes: 10 * 1024 * 1024,
      totalBytes: 10 * 1024 * 1024,
      partsDone: 3,
      totalParts: 3,
    });

    expect(deps.completeUpload).toHaveBeenCalledWith("v1", {
      uploadId: "u1",
      parts: [
        { partNumber: 1, etag: "etag-for-https://example.test/part-1" },
        { partNumber: 2, etag: "etag-for-https://example.test/part-2" },
        { partNumber: 3, etag: "etag-for-https://example.test/part-3" },
      ],
    });
  });

  it("propagates a part-upload failure and stops without completing", async () => {
    const file = fakeFile(10 * 1024 * 1024);
    const deps = fakeDeps({ uploadPart: vi.fn().mockRejectedValue(new Error("network error")) });

    await expect(uploadVideo(file, { title: "x" }, deps, undefined, 4 * 1024 * 1024)).rejects.toThrow(
      "network error",
    );
    expect(deps.completeUpload).not.toHaveBeenCalled();
  });
});
