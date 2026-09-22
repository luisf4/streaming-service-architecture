#!/usr/bin/env bash
# Stops RabbitMQ mid-pipeline and brings it back. validator/dispatcher/
# transcoder/aggregator all connect via messaging's connectWithRetry, so
# they reconnect with backoff and re-run assertTopology + restart their
# consumer once the broker is back - no manual restart of those containers
# needed.
set -euo pipefail

COMPOSE_FILE="$(cd "$(dirname "$0")/../../docker" && pwd)/docker-compose.yml"
DOWNTIME_SEC="${DOWNTIME_SEC:-15}"

echo "stopping rabbitmq for ${DOWNTIME_SEC}s"
docker compose -f "$COMPOSE_FILE" stop rabbitmq
sleep "$DOWNTIME_SEC"

echo "starting rabbitmq back up"
docker compose -f "$COMPOSE_FILE" start rabbitmq

echo "watch the worker logs for 'rabbitmq connect attempt N failed, retrying' then a normal 'listening on' line."
