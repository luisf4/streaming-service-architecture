import type { CompletedPart, StartUploadResponse, VideoResponse } from "./api-types";

/** S3/MinIO require every part but the last to be at least 5 MiB. */
export const MIN_PART_SIZE = 5 * 1024 * 1024;
export const DEFAULT_PART_SIZE = 8 * 1024 * 1024;

export interface UploadDeps {
  startUpload: (input: {
    title: string;
    description?: string;
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
  }) => Promise<StartUploadResponse>;
  presignPart: (videoId: string, uploadId: string, partNumber: number) => Promise<{ url: string }>;
  uploadPart: (url: string, chunk: Blob) => Promise<string>;
  completeUpload: (
    videoId: string,
    input: { uploadId: string; parts: CompletedPart[] },
  ) => Promise<VideoResponse>;
}

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  partsDone: number;
  totalParts: number;
}

export interface UploadMetadata {
  title: string;
  description?: string;
}

export async function uploadVideo(
  file: File,
  metadata: UploadMetadata,
  deps: UploadDeps,
  onProgress?: (progress: UploadProgress) => void,
  partSize: number = DEFAULT_PART_SIZE,
): Promise<VideoResponse> {
  const start = await deps.startUpload({
    title: metadata.title,
    description: metadata.description,
    originalFilename: file.name,
    contentType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  });

  const totalParts = Math.max(1, Math.ceil(file.size / partSize));
  const parts: CompletedPart[] = [];
  let uploadedBytes = 0;

  for (let index = 0; index < totalParts; index++) {
    const partNumber = index + 1;
    const from = index * partSize;
    const to = Math.min(file.size, from + partSize);
    const chunk = file.slice(from, to);

    const { url } = await deps.presignPart(start.videoId, start.uploadId, partNumber);
    const etag = await deps.uploadPart(url, chunk);
    parts.push({ partNumber, etag });

    uploadedBytes += chunk.size;
    onProgress?.({ uploadedBytes, totalBytes: file.size, partsDone: partNumber, totalParts });
  }

  return deps.completeUpload(start.videoId, { uploadId: start.uploadId, parts });
}

/** PUTs a part straight to its presigned URL and returns the ETag S3/MinIO assigns it. */
export async function uploadPartToPresignedUrl(url: string, chunk: Blob): Promise<string> {
  const response = await fetch(url, { method: "PUT", body: chunk });
  if (!response.ok) {
    throw new Error(`part upload failed (${response.status})`);
  }
  const etag = response.headers.get("etag");
  if (!etag) {
    throw new Error("upload response did not include an ETag header");
  }
  return etag.replaceAll('"', "");
}
