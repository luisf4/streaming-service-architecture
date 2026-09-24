"use client";

import { useEffect, useState } from "react";
import { getApiConfig } from "@/lib/config";
import { subscribeToStatus } from "@/lib/status-events";
import { ApiClient } from "@/lib/api-client";
import type { StatusEvent } from "@/lib/api-types";

export interface StatusViewProps {
  videoId: string;
}

export function StatusView({ videoId }: StatusViewProps) {
  const [status, setStatus] = useState<StatusEvent | null>(null);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    setConnectionError(false);
    const client = new ApiClient(getApiConfig());
    return subscribeToStatus(client.statusEventsUrl(videoId), setStatus, () => setConnectionError(true));
  }, [videoId]);

  if (connectionError) {
    return <p role="alert">Lost connection to the status stream. Reload the page to try again.</p>;
  }

  if (!status) {
    return <p>Waiting for status...</p>;
  }

  if (status.status === "FAILED") {
    return <p role="alert">Failed: {status.failureReason ?? "unknown error"}</p>;
  }

  if (status.status === "READY") {
    return (
      <p>
        Ready to watch! <a href={`/videos/${videoId}`}>Go to player</a>
      </p>
    );
  }

  return <p>Status: {status.status}</p>;
}
