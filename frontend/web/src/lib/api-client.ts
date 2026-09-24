import type {
  CompleteUploadRequest,
  CreateVideoRequest,
  PlayResponse,
  PresignPartResponse,
  StartUploadResponse,
  VideoResponse,
} from "./api-types";

export interface ApiClientConfig {
  uploadApiUrl: string;
  streamApiUrl: string;
}

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`request failed (${response.status}): ${body}`);
  }
  return response.json() as Promise<T>;
}

export class ApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  startUpload(input: CreateVideoRequest): Promise<StartUploadResponse> {
    return fetch(`${this.config.uploadApiUrl}/videos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => asJson<StartUploadResponse>(r));
  }

  presignPart(videoId: string, uploadId: string, partNumber: number): Promise<PresignPartResponse> {
    return fetch(
      `${this.config.uploadApiUrl}/videos/${videoId}/uploads/${uploadId}/parts/${partNumber}/presign`,
      { method: "POST" },
    ).then((r) => asJson<PresignPartResponse>(r));
  }

  completeUpload(videoId: string, input: CompleteUploadRequest): Promise<VideoResponse> {
    return fetch(`${this.config.uploadApiUrl}/videos/${videoId}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => asJson<VideoResponse>(r));
  }

  getVideo(videoId: string): Promise<VideoResponse> {
    return fetch(`${this.config.uploadApiUrl}/videos/${videoId}`).then((r) => asJson<VideoResponse>(r));
  }

  listVideos(): Promise<VideoResponse[]> {
    return fetch(`${this.config.uploadApiUrl}/videos`).then((r) => asJson<VideoResponse[]>(r));
  }

  statusEventsUrl(videoId: string): string {
    return `${this.config.uploadApiUrl}/videos/${videoId}/events`;
  }

  getPlayUrl(videoId: string): Promise<PlayResponse> {
    return fetch(`${this.config.streamApiUrl}/videos/${videoId}/play`).then((r) => asJson<PlayResponse>(r));
  }
}
