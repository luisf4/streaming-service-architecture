/**
 * Types for upload-api and stream-api's HTTP surface, sourced from each
 * service's real OpenAPI document (`@nestjs/swagger`) via
 * `openapi-typescript` - see `generate:api-types`. Never edit
 * `./generated/*` by hand; it's regenerated on every `build`/`typecheck`.
 */

import type { components as UploadApi } from "./generated/upload-api";
import type { components as StreamApi } from "./generated/stream-api";

export type CreateVideoRequest = UploadApi["schemas"]["CreateVideoDto"];
export type StartUploadResponse = UploadApi["schemas"]["StartUploadResponseDto"];
export type PresignPartResponse = UploadApi["schemas"]["PresignPartResponseDto"];
export type CompletedPart = UploadApi["schemas"]["CompletedPartDto"];
export type CompleteUploadRequest = UploadApi["schemas"]["CompleteUploadDto"];
export type VideoResponse = UploadApi["schemas"]["VideoResponseDto"];
export type VideoStatus = VideoResponse["status"];

export type PlayResponse = StreamApi["schemas"]["PlayResponseDto"];

/**
 * upload-api's /videos/:id/events is a Server-Sent Events stream, which
 * OpenAPI has no way to describe - so its payload shape isn't in the
 * generated schema. It's the same status fields as VideoResponse, pushed
 * one at a time as they change; Pick keeps it tied to the real DTO instead
 * of drifting as its own hand-kept copy.
 */
export type StatusEvent = Pick<VideoResponse, "status" | "manifestKey" | "failureReason">;
