"use client";

import { useState, type FormEvent } from "react";
import { getApiConfig } from "@/lib/config";
import { ApiClient } from "@/lib/api-client";
import { uploadPartToPresignedUrl, uploadVideo, type UploadProgress } from "@/lib/upload";
import { formatBytes } from "@/lib/format";
import { StatusView } from "./StatusView";
import styles from "./UploadForm.module.css";

export function UploadForm() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!file) return;

    setSubmitting(true);
    setError(null);
    setProgress(null);
    setVideoId(null);

    try {
      const client = new ApiClient(getApiConfig());
      const result = await uploadVideo(
        file,
        { title },
        {
          startUpload: (input) => client.startUpload(input),
          presignPart: (id, uploadId, partNumber) => client.presignPart(id, uploadId, partNumber),
          uploadPart: uploadPartToPresignedUrl,
          completeUpload: (id, input) => client.completeUpload(id, input),
        },
        setProgress,
      );
      setVideoId(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const percent = progress ? Math.round((progress.uploadedBytes / progress.totalBytes) * 100) : 0;

  return (
    <div>
      <form onSubmit={handleSubmit} className={styles.card}>
        <div className={styles.field}>
          <label htmlFor="title" className={styles.label}>
            Title
          </label>
          <input
            id="title"
            className={styles.input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="file" className={styles.label}>
            Video file
          </label>
          <input
            id="file"
            className={styles.input}
            type="file"
            accept="video/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          {file && (
            <span className={styles.fileHint}>
              {file.name} · {formatBytes(file.size)}
            </span>
          )}
        </div>
        <button type="submit" disabled={submitting || !file} className={styles.button}>
          {submitting ? "Uploading..." : "Upload"}
        </button>
        {progress && (
          <div className={styles.progress}>
            <progress
              aria-label="Upload progress"
              className={styles.progressBar}
              value={progress.uploadedBytes}
              max={progress.totalBytes}
            />
            <div className={styles.progressMeta}>
              <span>
                Part {progress.partsDone} of {progress.totalParts}
              </span>
              <span>
                {percent}% · {formatBytes(progress.uploadedBytes)} / {formatBytes(progress.totalBytes)}
              </span>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className={styles.alert}>
            {error}
          </p>
        )}
      </form>
      {videoId && <StatusView videoId={videoId} />}
    </div>
  );
}
