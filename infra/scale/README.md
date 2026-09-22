# Scale & chaos (Fase 9)

## Autoscaler

`autoscaler.sh` polls RabbitMQ's management API for `transcode.q`'s depth
and runs `docker compose up -d --scale transcoder=N`. It's the local/dev
stand-in for Fase 10's ASG + CloudWatch alarm on the same metric.

```bash
./autoscaler.sh
# tune via env: MESSAGES_PER_REPLICA, MIN_REPLICAS, MAX_REPLICAS, POLL_INTERVAL_SEC
```

## Chaos scripts

| Script | What it does | Expected outcome |
| --- | --- | --- |
| `chaos/kill-worker-mid-job.sh` | `SIGKILL`s a transcoder container while it holds an unacked job | RabbitMQ requeues the unacked message; another replica (or the restarted one) finishes it. Safe today. |
| `chaos/kill-rabbitmq.sh` | Stops RabbitMQ for `DOWNTIME_SEC` (default 15s), then starts it back | validator/dispatcher/transcoder/aggregator reconnect with backoff (`messaging`'s `connectWithRetry`) and resume consuming - no manual restart needed. Safe today. |
| `chaos/kill-postgres.sh` | Stops Postgres for `DOWNTIME_SEC` (default 8s), then starts it back | In-flight jobs fail their DB call, retry via the normal retry queue, and succeed once Postgres is back - as long as the outage stays under the retry window (~15s with today's defaults). Longer outages push jobs to the DLQ instead. |

**Known gap:** upload-api's outbox relay, status consumer (SSE) and event
publisher get their RabbitMQ channel once at boot via Nest DI and do not
yet reconnect after a broker restart - only the four pipeline workers do.
Revisit if upload-api itself needs to survive `kill-rabbitmq.sh` without a
manual restart.

None of these have been run in this environment (no Docker available
here) - verify against a real `docker compose up` stack before relying on
the "expected outcome" column.
