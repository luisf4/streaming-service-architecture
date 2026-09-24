# video-streaming

Upload a video, it gets chunked and transcoded to multiple resolutions in
parallel, and comes out the other side as an HLS stream - built to learn
the pipeline (chunking, fan-out/fan-in, retry/DLQ, idempotency,
distributed tracing, horizontal scaling), not as a product. See
`PLAN.md` for the original phase-by-phase plan this was built from, and
`docs/adrs/` for the reasoning behind the six biggest decisions.

## Architecture

```mermaid
flowchart TD
    FE[frontend/web]
    UA[upload-api]
    VAL[validator<br/>ffprobe]
    DIS[dispatcher<br/>keyframe-aligned chunks]
    TC[transcoder x N replicas<br/>ffmpeg per chunk x resolution]
    AGG[aggregator<br/>fan-in, playlists]
    SA[stream-api]
    CDN[CloudFront / Nginx]
    DB[(Postgres)]
    S3[(S3 / MinIO<br/>raw + hls buckets)]

    %% synchronous calls, and the browser's own direct-to-storage data plane
    FE -->|start / presign part / complete| UA
    FE -->|PUT each part, presigned| S3
    FE -->|SSE status| UA
    FE -->|GET play, gets back a signed URL| SA
    FE -->|HLS manifest + segments| CDN
    CDN --> S3

    %% one async event each, over one shared RabbitMQ broker
    UA -.->|video.uploaded, via outbox| VAL
    VAL -.->|video.validated| DIS
    VAL -.->|video.validation.failed| UA
    DIS -.->|transcode.requested x N| TC
    TC -.->|chunk.transcoded| AGG
    AGG -.->|video.ready| UA

    %% storage: who reads/writes what
    UA ==>|video row: status| DB
    UA ==>|create / complete multipart upload| S3
    VAL ==>|read source| S3
    DIS ==>|read source| S3
    DIS ==>|Chunk, TranscodeJob rows, status: PROCESSING| DB
    TC ==>|read source, write segment| S3
    AGG ==>|Rendition rows| DB
    AGG ==>|write playlists| S3
    SA ==>|read video row| DB
```

Solid arrows are synchronous calls - including the browser's own
presigned `PUT`s straight to S3/MinIO, so upload-api orchestrates the
multipart upload but never sees the video bytes themselves. Dashed
arrows are one async event each from
`backend/packages/contracts/src/events/`, versioned and validated with
zod, routed over a single RabbitMQ broker - every consumer gets its own
retry queue (TTL + dead-letter) and DLQ, see
`backend/packages/messaging/src/topology.ts` and ADR 0001. Thick arrows
are a storage read or write (Postgres or S3/MinIO); `Video.status`
itself is only ever written by upload-api or dispatcher - never by
validator, transcoder or aggregator, which only publish the event or
persist their own rows (Chunk/TranscodeJob, Rendition).

## Repo layout

```
backend/
  apps/       upload-api, stream-api (NestJS, HTTP) + validator,
              dispatcher, transcoder, aggregator (plain Node workers)
  packages/   contracts, messaging, database, storage, observability,
              config (shared across every app)
frontend/web  Next.js + hls.js
infra/
  docker/     docker-compose for local dev (Postgres, RabbitMQ, MinIO,
              Nginx, Jaeger, Prometheus, Grafana, and all 8 apps)
  terraform/  AWS (sa-east-1 applied, us-east-1 plan-only)
  scale/      autoscaler + chaos scripts (Fase 9)
load-tests/   k6 upload scenario
docs/adrs/    the six ADRs
```

## Running it locally

Needs Docker (compose v2) and Node >=20 with pnpm.

```bash
pnpm install
cp .env.example .env   # only needed running an app outside docker-compose
docker compose -f infra/docker/docker-compose.yml up -d --build
```

That brings up Postgres, RabbitMQ, MinIO, Nginx, Jaeger, Prometheus,
Grafana, and all 8 application services. Two one-shot containers
(`migrate`, `minio-init`) run first and exit - Prisma migrations and the
`raw`/`hls` MinIO buckets aren't there on a first boot otherwise - and
every app service waits on both before starting.

```bash
docker compose -f infra/docker/docker-compose.yml ps            # what's up
docker compose -f infra/docker/docker-compose.yml logs -f web   # tail one service
docker compose -f infra/docker/docker-compose.yml up -d --build web   # rebuild after editing one service
docker compose -f infra/docker/docker-compose.yml down          # stop everything (add -v to also drop volumes/data)
```

Once it's up, here's every port it opens:

| Port | Service | What's there |
| --- | --- | --- |
| 3003 | web | The app itself: upload a video, browse `/videos`, watch one |
| 3001 | upload-api | REST API the web app calls to upload; OpenAPI docs at `/docs` |
| 3002 | stream-api | REST API the web app calls to play; OpenAPI docs at `/docs` |
| 8080 | nginx | Proxies presigned upload/playback URLs straight to MinIO - not the app APIs |
| 3000 | grafana | Dashboards: queue depth, jobs/s and DLQ rate by service, job duration, time-to-READY (admin/streaming, or anonymous) |
| 16686 | jaeger | Distributed tracing UI, one trace per request across every service |
| 9091 | prometheus | Raw metrics (Grafana's datasource; rarely opened directly) |
| 15672 | rabbitmq | Management UI: queues, DLQs, message rates (streaming/streaming) |
| 9001 | minio | Object storage console: `raw`/`hls` buckets (streaming/streamingsecret) |
| 5432 | postgres | Database - `psql postgresql://streaming:streaming@localhost:5432/streaming` |
| 5672 | rabbitmq | AMQP, used by the backend services, not meant to be opened by hand |
| 9000 | minio | S3 API, used by the backend services, not meant to be opened by hand |
| 4318 | jaeger | OTLP HTTP, where every service's traces get pushed to |
| 15692 | rabbitmq | Prometheus metrics endpoint, scraped by `prometheus` |

For everyday development (not full-stack docker), run the monorepo's own
tasks instead:

```bash
pnpm run lint
pnpm run test           # unit tests - no Docker needed
pnpm run test:integration   # Testcontainers-backed integration tests - needs Docker
pnpm run typecheck
pnpm run build
```

**`docker compose up` has been run end to end** (Docker wasn't available
when most of this was built - see git history) with a real generated MP4:
upload → `video.uploaded` → validator (real `ffprobe`) → dispatcher
(keyframe-aligned chunks) → transcoder → aggregator → `video.ready`, all
the way to `GET /videos/:id/play` returning a signed URL whose manifest,
sub-playlists and segments all played back through Nginx. That run
surfaced and fixed several bugs no unit test caught: a Prisma engine
built for the wrong OpenSSL version on arm64, `@aws-sdk/client-s3`'s
default checksum behavior breaking every presigned URL, Nginx's 1 MB body
cap and its `$host` variable dropping the port (breaking SigV4
signatures), a `BigInt` field that crashed `JSON.stringify` on the first
real response, and MinIO's Docker Hub images having moved to `quay.io`.

**Known gap, not fixed**: hls.js resolves a sub-resolution playlist and
its `.ts` segments as paths relative to the master `.m3u8` - none of
which carry the master's own presigned query string. `stream-api` only
signs the master, so anything past it 403s unless the bucket allows
anonymous reads. `minio-init` sets `local/hls` to public `download` for
exactly this reason; the same problem exists in the CloudFront path
(`CloudFrontManifestUrlSigner` signs one object too) and isn't fixed
there - Fase 10 needs either a wildcard/custom CloudFront policy or an
authenticated proxy for HLS sub-resources.

Not run in this environment: `pnpm run test:integration` (Testcontainers
pull additional images), the Terraform `plan`/`apply` in
`infra/terraform/`, and the k6/chaos scripts in `load-tests/` and
`infra/scale/`.

## What happens when X fails

- **A transcoder dies mid-job** (`infra/scale/chaos/kill-worker-mid-job.sh`).
  The job's message was never acked, so RabbitMQ redelivers it once the
  connection drops - another replica (or the same one, once restarted)
  picks it up. `processed_events` means even a job that actually finished
  right before the kill won't be double-counted.
- **RabbitMQ restarts** (`infra/scale/chaos/kill-rabbitmq.sh`). validator,
  dispatcher, transcoder and aggregator all reconnect with exponential
  backoff and re-run `assertTopology` + restart their consumer
  (`messaging`'s `connectWithRetry`,
  `backend/packages/messaging/src/resilient-connection.ts`). upload-api
  does not yet do this - see ADR follow-ups / `infra/scale/README.md`'s
  known-gap note.
- **Postgres restarts.** A query against a down Postgres just throws; the
  consumer's normal retry/DLQ path (0001) requeues the message with
  backoff. It only self-heals if the outage is shorter than the retry
  window (~15s with today's defaults) - a longer outage pushes the job to
  the DLQ instead of just delaying it.
- **A chunk fails to transcode 3 times** (bad input, ffmpeg crash, whatever).
  It lands in `transcode.dlq`, untouched, for manual inspection - the video
  stays stuck below `READY` rather than silently missing a resolution.
- **ffprobe can't make sense of an uploaded file.** validator treats that
  as a business outcome, not an infra failure: it publishes
  `video.validation.failed` (no retry - retrying a corrupt file doesn't
  help), and upload-api marks the video `FAILED` with the reason attached.

## Benchmarks

`load-tests/README.md` has the k6 scenario and a benchmark table
template (`--scale transcoder=1,5,10`) - left blank, to fill in from a
real run rather than invented numbers.

## Screenshots / GIF

Not included. The stack now runs end to end (see above) and a video
played back through it in this same environment, but there's no display
here to record a browser against - `docs/adrs/` and this README are the
place to add a GIF of the player and prints of Jaeger/Grafana once someone
runs `docker compose up` with one.

The Grafana dashboard itself (`infra/docker/grafana/provisioning/dashboards/`)
is provisioned and loads automatically with the stack - queue depth,
jobs/s and DLQ rate by service, job duration (p50/p95), and time-to-READY
per video (p50/p95, the metric behind the benchmark table above).
