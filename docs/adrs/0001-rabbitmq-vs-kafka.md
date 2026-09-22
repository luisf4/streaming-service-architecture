# 0001 - RabbitMQ instead of Kafka

## Status

Accepted (decided in PLAN.md before any code existed).

## Context

The pipeline needs: fan-out of one `video.uploaded` into N chunk×resolution
jobs, per-job retry with backoff, a dead-letter path after N attempts, and
a way to route different event types (`video.uploaded`, `chunk.transcoded`,
`video.ready`, `*.failed`) to different consumers.

## Decision

RabbitMQ, not Kafka.

- **Retry/DLQ are first-class primitives.** A per-queue retry queue
  (TTL + dead-letter-exchange back to the main queue) and a DLQ are just
  queue arguments (`x-message-ttl`, `x-dead-letter-exchange`) - see
  `backend/packages/messaging/src/topology.ts`. Kafka has no native
  per-message retry/backoff; it's usually bolted on with a separate
  retry-topic-and-consumer-loop scheme, which is exactly the mechanism
  RabbitMQ gives for free.
- **Routing by event type is a topic exchange, not partition math.**
  `video.events` is a topic exchange; `upload-api.status.q` binds both
  `video.ready` and the wildcard `video.*.failed` onto the same queue
  (`backend/packages/contracts/src/routing.ts`). Kafka would need either
  one topic per event type (fine) or a single topic with consumers
  filtering by a payload field (more code, no broker-level guarantee).
- **Throughput isn't the bottleneck here.** ffmpeg transcoding a chunk
  takes seconds; RabbitMQ's message rate ceiling is irrelevant next to
  that. Kafka's advantage - sustained high-throughput log replay - doesn't
  buy anything this pipeline needs.
- **Operationally simpler for a single-host demo deployment** (Fase 10):
  one container, a management UI and a Prometheus exporter
  (`rabbitmq_prometheus` plugin) built in. Kafka needs ZooKeeper/KRaft plus
  more memory than the `t3.small` core host budgets for.

## Consequences

- No log-based replay: once a message is acked, it's gone. That's fine
  here - `processed_events` (idempotency) plus the DB rows themselves are
  the source of truth, not the queue.
- Idempotent consumption still has to be handled explicitly (see 0003) -
  RabbitMQ doesn't give exactly-once delivery either.
