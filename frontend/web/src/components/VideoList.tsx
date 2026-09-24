"use client";

import { useEffect, useState } from "react";
import { getApiConfig } from "@/lib/config";
import { ApiClient } from "@/lib/api-client";
import { formatDate, formatDuration } from "@/lib/format";
import type { VideoResponse } from "@/lib/api-types";
import styles from "./VideoList.module.css";

export function VideoList() {
  const [videos, setVideos] = useState<VideoResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = new ApiClient(getApiConfig());
    client
      .listVideos()
      .then(setVideos)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) {
    return (
      <p role="alert" className={styles.alert}>
        {error}
      </p>
    );
  }

  if (!videos) {
    return <p className={styles.state}>Loading videos...</p>;
  }

  if (videos.length === 0) {
    return (
      <p className={styles.state}>
        No videos yet. <a href="/">Upload one</a> to see it here.
      </p>
    );
  }

  return (
    <ul className={styles.list}>
      {videos.map((video) => (
        <li key={video.id} className={styles.row}>
          <div className={styles.rowMain}>
            <p className={styles.title}>
              {video.status === "READY" ? <a href={`/videos/${video.id}`}>{video.title}</a> : video.title}
            </p>
            <p className={styles.meta}>
              {formatDate(video.createdAt)}
              {video.durationSec !== null ? ` · ${formatDuration(video.durationSec)}` : ""}
            </p>
          </div>
          <span className={styles.status} data-status={video.status}>
            {video.status}
          </span>
        </li>
      ))}
    </ul>
  );
}
