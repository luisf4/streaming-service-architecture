#!/usr/bin/env bash
# Stops Postgres mid-pipeline and brings it back. Workers don't hold a
# persistent DB connection the way they do for RabbitMQ - a query that hits
# a down Postgres just throws, which EventConsumer treats like any other
# handler failure: the message goes to the retry queue with backoff and
# comes back a few seconds later, by which point Postgres should be back.
# This only holds if DOWNTIME_SEC stays well under the retry window
# (maxAttempts * retry TTL, ~15s with today's defaults) - a longer outage
# will push in-flight jobs to the DLQ instead of just delaying them.
set -euo pipefail

COMPOSE_FILE="$(cd "$(dirname "$0")/../../docker" && pwd)/docker-compose.yml"
DOWNTIME_SEC="${DOWNTIME_SEC:-8}"

echo "stopping postgres for ${DOWNTIME_SEC}s"
docker compose -f "$COMPOSE_FILE" stop postgres
sleep "$DOWNTIME_SEC"

echo "starting postgres back up"
docker compose -f "$COMPOSE_FILE" start postgres

echo "watch a video's status - jobs in flight during the outage should retry and still reach READY."
