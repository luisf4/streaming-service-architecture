#!/usr/bin/env bash
# Runs the upload scenario at 10, 50 and 200 concurrent VUs against a live
# stack (docker compose up first) and saves one JSON summary per run under
# load-tests/results/. Fase 9's benchmark table is built from these.
set -euo pipefail

cd "$(dirname "$0")"

UPLOAD_API_URL="${UPLOAD_API_URL:-http://localhost:3001}"
mkdir -p results

for vus in 10 50 200; do
  echo "=== running upload-scenario.js with VUS=${vus} ==="
  UPLOAD_API_URL="$UPLOAD_API_URL" VUS="$vus" ITERATIONS="$vus" \
    k6 run --summary-export "results/upload-vus-${vus}.json" upload-scenario.js
done

echo "Done. Summaries in load-tests/results/."
