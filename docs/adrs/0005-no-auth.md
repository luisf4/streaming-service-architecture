# 0005 - No authentication

## Status

Accepted (decided in PLAN.md before any code existed: "Auth: sem auth
(foco no pipeline)").

## Context

Every video-hosting product needs auth eventually - who can upload, whose
videos show up where, who can watch what. None of that is what this
project is about.

## Decision

Ship with no authentication or authorization anywhere: `upload-api` and
`stream-api` accept any request, any video id is playable by anyone who
has it. The entire point of this project is the processing pipeline
(chunking, parallel transcode, fan-in, retry/DLQ, observability, scaling)
- auth is a well-understood, separately-solved problem (session cookies,
JWTs, an identity provider) that would add surface area without teaching
anything new about the pipeline itself.

## Consequences

- **Not deployable as a real product as-is.** Anyone with network access
  to `upload-api`/`stream-api` can upload arbitrary files and read any
  video's manifest URL. This is fine for a local/demo/portfolio
  deployment; it is a hard blocker for handling real user data or running
  with a public unauthenticated CDN endpoint at real stakes.
- CloudFront signed URLs (0002... see the cdn module) limit who can fetch
  *HLS segments* without a valid signature, but `stream-api`'s
  `GET /videos/:id/play` itself hands that signed URL to anyone who asks -
  it's access control on the CDN transport, not on who can request a play
  URL in the first place.
- Adding auth later is additive, not a rewrite: a `videos` table with an
  `owner_id` column, an auth middleware/guard in front of the existing
  NestJS controllers, and the frontend attaching a session token to its
  existing typed API client calls. Nothing in the pipeline (validator
  through aggregator) needs to know about users at all.
