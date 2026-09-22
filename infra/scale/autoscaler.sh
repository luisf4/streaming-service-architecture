#!/usr/bin/env bash
# Simple autoscaler for Fase 9: polls RabbitMQ's management API for
# transcode.q's depth and scales the transcoder service with
# `docker compose up -d --scale`. Not a replacement for the ASG + CloudWatch
# alarm in Fase 10 (infra/terraform) - this is the local/dev equivalent.
set -euo pipefail

RABBITMQ_API="${RABBITMQ_API:-http://streaming:streaming@localhost:15672/api}"
QUEUE="${QUEUE:-transcode.q}"
MIN_REPLICAS="${MIN_REPLICAS:-1}"
MAX_REPLICAS="${MAX_REPLICAS:-10}"
MESSAGES_PER_REPLICA="${MESSAGES_PER_REPLICA:-50}"
POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-15}"
COMPOSE_FILE="$(cd "$(dirname "$0")/../docker" && pwd)/docker-compose.yml"

echo "autoscaler watching '${QUEUE}' every ${POLL_INTERVAL_SEC}s (${MIN_REPLICAS}-${MAX_REPLICAS} replicas, ${MESSAGES_PER_REPLICA} msgs/replica)"

current_replicas=""

while true; do
  depth=$(curl -sf "${RABBITMQ_API}/queues/%2F/${QUEUE}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('messages', 0))" 2>/dev/null || echo 0)

  desired=$(( (depth + MESSAGES_PER_REPLICA - 1) / MESSAGES_PER_REPLICA ))
  if [ "$desired" -lt "$MIN_REPLICAS" ]; then desired=$MIN_REPLICAS; fi
  if [ "$desired" -gt "$MAX_REPLICAS" ]; then desired=$MAX_REPLICAS; fi

  if [ "$desired" != "$current_replicas" ]; then
    echo "$(date -u +%FT%TZ) queue=${QUEUE} depth=${depth} -> scaling transcoder to ${desired}"
    docker compose -f "$COMPOSE_FILE" up -d --scale "transcoder=${desired}" --no-recreate
    current_replicas="$desired"
  fi

  sleep "$POLL_INTERVAL_SEC"
done
