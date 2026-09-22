/**
 * Types for upload-api and stream-api's HTTP surface.
 *
 * The real pipeline (see `generate:api-types`) generates these from each
 * service's live OpenAPI document (`@nestjs/swagger`, exposed at
 * /docs-json) with `openapi-typescript`, so the front never imports
 * backend code - only this HTTP contract. This file is hand-kept in sync
 * with the current DTOs in backend/apps/{upload,stream}-api/src while no
 * running backend is available to generate it from; regenerate it for
 * real once the services are up.
 */

export interface CreateVideoRequest {
  title: string;
  description?: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
}

export interface StartUploadResponse {
  videoId: string;
  uploadId: string;
  bucket: string;
  key: string;
}

export interface PresignPartResponse {
  url: string;
}

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

export interface CompleteUploadRequest {
  uploadId: string;
  parts: CompletedPart[];
}

export type VideoStatus = "UPLOADING" | "UPLOADED" | "PROCESSING" | "READY" | "FAILED";

export interface VideoResponse {
  id: string;
  title: string;
  description: string | null;
  status: VideoStatus;
  durationSec: number | null;
  manifestKey: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatusEvent {
  status: VideoStatus;
  manifestKey: string | null;
  failureReason: string | null;
}

export interface PlayResponse {
  manifestUrl: string;
  expiresInSec: number;
}
