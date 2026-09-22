"use client";

import { useState, type FormEvent } from "react";
import { getApiConfig } from "@/lib/config";
import { ApiClient } from "@/lib/api-client";
import { uploadPartToPresignedUrl, uploadVideo, type UploadProgress } from "@/lib/upload";
import { StatusView } from "./StatusView";

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

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="title">Title</label>
          <input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="file">Video file</label>
          <input
            id="file"
            type="file"
            accept="video/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <button type="submit" disabled={submitting || !file}>
          {submitting ? "Uploading..." : "Upload"}
        </button>
        {progress && (
          <progress
            aria-label="Upload progress"
            value={progress.uploadedBytes}
            max={progress.totalBytes}
          />
        )}
        {error && <p role="alert">{error}</p>}
      </form>
      {videoId && <StatusView videoId={videoId} />}
    </div>
  );
}
