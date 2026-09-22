"use client";

import { useEffect, useState } from "react";
import { getApiConfig } from "@/lib/config";
import { ApiClient } from "@/lib/api-client";
import { VideoPlayer } from "./VideoPlayer";

export interface PlayerPageProps {
  videoId: string;
}

export function PlayerPage({ videoId }: PlayerPageProps) {
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = new ApiClient(getApiConfig());
    client
      .getPlayUrl(videoId)
      .then((response) => setManifestUrl(response.manifestUrl))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [videoId]);

  if (error) {
    return <p role="alert">{error}</p>;
  }
  if (!manifestUrl) {
    return <p>Loading...</p>;
  }
  return <VideoPlayer manifestUrl={manifestUrl} />;
}
