#!/usr/bin/env bash
# Builds every backend service one at a time, then brings the stack up.
#
# `docker compose ... up -d --build` hands all 7 backend Dockerfile builds to
# BuildKit's `bake` backend at once, which runs their `pnpm install` steps in
# parallel - Docker Desktop's default memory limit can't take that many
# concurrent Node processes and the build dies with `ResourceExhausted:
# ... cannot allocate memory`. Compose has no flag to turn bake off (it's the
# only build path as of Compose v5), so the fix is to never hand it more than
# one service at a time.
set -euo pipefail

cd "$(dirname "$0")"

services=(migrate upload-api stream-api validator dispatcher transcoder aggregator web)

for service in "${services[@]}"; do
  echo "==> building $service"
  docker compose -f docker-compose.yml build "$service"
done

docker compose -f docker-compose.yml up -d
