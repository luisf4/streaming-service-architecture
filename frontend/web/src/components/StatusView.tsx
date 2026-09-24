"use client";

import { useEffect, useState } from "react";
import { getApiConfig } from "@/lib/config";
import { subscribeToStatus } from "@/lib/status-events";
import { ApiClient } from "@/lib/api-client";
import type { StatusEvent } from "@/lib/api-types";
import styles from "./StatusView.module.css";

export interface StatusViewProps {
  videoId: string;
}

const STEPS: { status: StatusEvent["status"]; label: string }[] = [
  { status: "UPLOADING", label: "Uploading" },
  { status: "UPLOADED", label: "Uploaded" },
  { status: "PROCESSING", label: "Processing" },
  { status: "READY", label: "Ready" },
];

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8.5L6.5 12L13 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
    return (
      <p role="alert" className={styles.alert}>
        Lost connection to the status stream. Reload the page to try again.
      </p>
    );
  }

  if (!status) {
    return (
      <div className={styles.wrap}>
        <p className={styles.waiting}>Waiting for status...</p>
      </div>
    );
  }

  if (status.status === "FAILED") {
    return (
      <div className={styles.wrap}>
        <p role="alert" className={styles.alert}>
          Failed: {status.failureReason ?? "unknown error"}
        </p>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((step) => step.status === status.status);
  const isReady = status.status === "READY";

  return (
    <div className={styles.wrap}>
      <ol className={styles.stepper}>
        {STEPS.map((step, index) => (
          <li
            key={step.status}
            className={styles.step}
            data-done={index < currentIndex || isReady}
            data-current={!isReady && index === currentIndex}
          >
            <span className={styles.dot}>
              {index < currentIndex || isReady ? <CheckIcon /> : index + 1}
            </span>
            <span className={styles.stepLabel}>{step.label}</span>
          </li>
        ))}
      </ol>
      {status.status === "READY" && (
        <div className={styles.ready}>
          <p className={styles.readyText}>Ready to watch</p>
          <a href={`/videos/${videoId}`} className={styles.playLink}>
            Go to player
          </a>
        </div>
      )}
    </div>
  );
}
