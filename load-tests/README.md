# Load tests (Fase 9)

`upload-scenario.js` drives upload-api's real multipart flow (start ->
presign part(s) -> PUT each part -> complete) with [k6](https://k6.io).
The payload is synthetic bytes sized to `FILE_SIZE_BYTES`, not a real video,
so this measures upload-api/MinIO capacity, not full-pipeline (transcode)
throughput.

Verified against a local fake server (`test/fake-upload-api.js`) exercising
the same request sequence upload-api expects; it has not been run against a
live upload-api/MinIO in this environment.

## Run

```bash
# bring the stack up first: docker compose -f infra/docker/docker-compose.yml up -d
./run.sh
# or a single run:
UPLOAD_API_URL=http://localhost:3001 VUS=50 ITERATIONS=50 k6 run upload-scenario.js
```

`run.sh` runs 10, 50 and 200 VUs and saves one JSON summary per run under
`results/` (gitignored - these are local run artifacts, not committed
benchmark numbers).

## Scaling transcoder for the pipeline side

```bash
docker compose -f infra/docker/docker-compose.yml up -d --scale transcoder=5
```

Compare `transcode.q` depth and per-video time-to-READY (both visible in
Grafana once Fase 8's stack is up) across `--scale transcoder=1,5,10` to
fill in a benchmark table like:

| transcoder replicas | uploads | p50 time-to-READY | p95 time-to-READY | DLQ rate |
| -------------------- | ------- | ------------------ | ------------------ | -------- |
| 1                     |         |                     |                     |          |
| 5                     |         |                     |                     |          |
| 10                    |         |                     |                     |          |

(Left blank here - fill it in from real runs; see `infra/scale/` for the
autoscaler and chaos scripts used alongside these load tests.)
