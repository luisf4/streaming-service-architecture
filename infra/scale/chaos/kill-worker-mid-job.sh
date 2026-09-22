#!/usr/bin/env bash
# Kills one transcoder replica mid-job (SIGKILL, no graceful shutdown) to
# prove a job in flight isn't lost: the message stays unacked, RabbitMQ
# requeues it once the connection drops, and either another replica or the
# same one after restart picks it back up. Idempotency (processed_events)
# guards against double-counting if it was actually finished right as it died.
set -euo pipefail

COMPOSE_FILE="$(cd "$(dirname "$0")/../../docker" && pwd)/docker-compose.yml"

container_id=$(docker compose -f "$COMPOSE_FILE" ps -q transcoder | head -n1)
if [ -z "$container_id" ]; then
  echo "no transcoder container running - start the stack (and maybe scale transcoder up) first" >&2
  exit 1
fi

echo "SIGKILLing transcoder container ${container_id}"
docker kill --signal=SIGKILL "$container_id"

echo "restarting it (restart: unless-stopped only covers crashes it caused itself, not an external kill -9)"
docker compose -f "$COMPOSE_FILE" up -d transcoder

echo "watch the transcode.q depth in Grafana/Prometheus and the video's status - it should still reach READY."
