import http from "k6/http";
import { check, sleep } from "k6";

// Exercises upload-api's real multipart flow end to end (start -> presign
// part(s) -> PUT each part -> complete) under load. The payload is
// synthetic bytes, not a real video, so it will reach UPLOADED but is not
// expected to make it through validator's ffprobe step - this scenario is
// about upload-api/MinIO capacity under concurrent uploads (Fase 9's
// "k6 com 10, 50, 200 uploads"), not full-pipeline correctness.

const UPLOAD_API = __ENV.UPLOAD_API_URL || "http://localhost:3001";
const PART_SIZE = 5 * 1024 * 1024; // S3/MinIO minimum part size (except the last part)
const FILE_SIZE_BYTES = Number(__ENV.FILE_SIZE_BYTES || PART_SIZE);

export const options = {
  scenarios: {
    uploads: {
      executor: "shared-iterations",
      vus: Number(__ENV.VUS || 10),
      iterations: Number(__ENV.ITERATIONS || __ENV.VUS || 10),
      maxDuration: __ENV.MAX_DURATION || "10m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{step:complete}": ["p(95)<5000"],
  },
};

function randomBody(size) {
  // k6's http.put needs a body; content doesn't matter for this scenario,
  // only its size (which drives part-count and payload transfer cost).
  return "a".repeat(size);
}

export default function () {
  const startRes = http.post(
    `${UPLOAD_API}/videos`,
    JSON.stringify({
      title: `k6-load-${__VU}-${__ITER}`,
      originalFilename: "load-test.mp4",
      contentType: "video/mp4",
      sizeBytes: FILE_SIZE_BYTES,
    }),
    { headers: { "Content-Type": "application/json" }, tags: { step: "start" } },
  );
  check(startRes, { "start: 201": (r) => r.status === 201 });
  if (startRes.status !== 201) return;

  const { videoId, uploadId } = startRes.json();
  const partCount = Math.max(1, Math.ceil(FILE_SIZE_BYTES / PART_SIZE));
  const parts = [];

  for (let partNumber = 1; partNumber <= partCount; partNumber++) {
    const presignRes = http.post(
      `${UPLOAD_API}/videos/${videoId}/uploads/${uploadId}/parts/${partNumber}/presign`,
      null,
      { tags: { step: "presign" } },
    );
    check(presignRes, { "presign: 201": (r) => r.status === 201 });
    if (presignRes.status !== 201) return;

    const partSize = Math.min(PART_SIZE, FILE_SIZE_BYTES - (partNumber - 1) * PART_SIZE);
    const putRes = http.put(presignRes.json("url"), randomBody(partSize), { tags: { step: "put_part" } });
    check(putRes, { "put_part: 200": (r) => r.status === 200 });
    if (putRes.status !== 200) return;

    const etag = (putRes.headers["Etag"] || putRes.headers["ETag"] || "").replaceAll('"', "");
    parts.push({ partNumber, etag });
  }

  const completeRes = http.post(
    `${UPLOAD_API}/videos/${videoId}/complete`,
    JSON.stringify({ uploadId, parts }),
    { headers: { "Content-Type": "application/json" }, tags: { step: "complete" } },
  );
  check(completeRes, { "complete: 200": (r) => r.status === 200 });

  sleep(1);
}
