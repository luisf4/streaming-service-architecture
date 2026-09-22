# 0003 - Transactional outbox for upload-api's first event

## Status

Accepted.

## Context

Completing an upload needs two things to happen together: mark the video
`UPLOADED` in Postgres, and publish `video.uploaded` so the validator picks
it up. Doing them as two separate operations (write DB, then publish) has
a failure window: if the process dies after the DB write but before the
publish, the video is stuck `UPLOADED` forever with nothing to move it
along, and there's no generic way to notice.

## Decision

Write the outbox row in the same Postgres transaction as the status
update, then relay it asynchronously. `VideosService.completeUpload`
(`backend/apps/upload-api/src/videos/videos.service.ts`) wraps both the
`video.updateStatus` call and `outbox.enqueue` in one `prisma.$transaction`,
so either both land or neither does - there's no window where the DB says
`UPLOADED` but no event was durably queued to be sent. A separate
`OutboxRelayService` polls the `outbox` table on an interval, publishes
each unpublished row to RabbitMQ, and marks it published
(`backend/apps/upload-api/src/outbox/outbox-relay.service.ts`).

## Consequences

- The publish is now at-least-once and slightly delayed (bounded by the
  poll interval, `OUTBOX_POLL_INTERVAL_MS`), not synchronous with the HTTP
  request. That's the right tradeoff here - nothing downstream is
  latency-sensitive to the millisecond.
- The relay and the actual `EventConsumer`s downstream both need
  idempotent handling (retries can double-publish/double-process) - this
  is the same `processed_events` mechanism described for 0001, applied
  consistently everywhere, not just at the outbox.
- Only upload-api's `video.uploaded` goes through an outbox today. Every
  other event is published directly, right after its DB transaction
  commits, from inside a queue consumer
  (`dispatcher`/`transcoder`/`aggregator`'s handlers). If the *handler
  itself* throws before publishing, that's fine - the message it was
  processing never gets acked, RabbitMQ's normal retry/DLQ path (0001)
  reruns the whole handler, DB write included. But a process crash in the
  narrow window between the transaction committing and the publish call
  actually returning (dispatcher fanning out N `transcode.requested`
  events after committing the chunk/job rows is the widest such window)
  has the same gap the outbox exists to close, just not covered by one.
  **Known gap, not yet fixed**: extending the outbox pattern to those
  handlers (or accepting occasional stuck jobs there, reconciled by a
  periodic sweep) is a real follow-up, not something already solved by
  analogy to upload-api.
