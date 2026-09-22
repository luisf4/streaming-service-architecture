import type { ApiClientConfig } from "./api-client";

export function getApiConfig(): ApiClientConfig {
  return {
    uploadApiUrl: process.env.NEXT_PUBLIC_UPLOAD_API_URL ?? "http://localhost:3001",
    streamApiUrl: process.env.NEXT_PUBLIC_STREAM_API_URL ?? "http://localhost:3002",
  };
}
