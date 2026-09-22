# 0002 - Fan out by chunk × resolution, independently re-encoded

## Status

Accepted, after a dedicated spike (Fase 4, before writing the real
dispatcher/transcoder code - see `backend/apps/dispatcher/test/unit/chunk-splice.spike.test.ts`).

## Context

Transcoding a whole video to multiple resolutions serially is slow and
doesn't parallelize across machines. The plan called for splitting each
video into chunks and transcoding chunk×resolution pairs independently
(Fase 4/5), fanning in in the aggregator (Fase 6). The open question was
whether independently-encoded chunks reassemble into a video that plays
back cleanly - if they don't, the whole design is wrong and everything
built on top of it (dispatcher, transcoder, aggregator) would need
rethinking.

## Decision

Split at keyframes only. `planChunks` (`backend/apps/dispatcher/src/chunk-plan.ts`)
picks boundaries at the source's own keyframe at-or-after each multiple of
the target chunk length (`getKeyframeTimestamps` via ffprobe), never an
arbitrary timestamp. The transcoder then does one ffmpeg invocation per
(chunk, resolution): `-ss start -t duration -i sourceUrl ...`, a
completely independent encode with its own GOP structure
(`backend/apps/transcoder/src/transcode.ts`).

The spike (real ffmpeg/ffprobe, not mocked) found that naively
concatenating those independent encodes into one HLS playlist made
ffmpeg's own HLS demuxer report `Packet corrupt` at every splice - it
expects a continuous PCR from a single encoder session. The fix:
`#EXT-X-DISCONTINUITY` before every splice after the first, which tells
the demuxer/player to reset its timestamp-continuity expectation at that
boundary instead of flagging it as corruption. With that one tag, decode
was clean and frame-accurate (see the spike test's assertions on frame
count and keyframe alignment). The aggregator's real playlist builder
(`backend/apps/aggregator/src/playlist.ts`) carries this forward.

## Consequences

- Every chunk boundary in a resolution's playlist is a discontinuity. Real
  HLS players handle this correctly (it's exactly what it's for); a naive
  tool that just concatenates `.ts` bytes and demuxes the result as one
  continuous stream (like the first version of this spike did) will not.
- Chunk boundaries are keyframe-dependent, so actual chunk length varies
  slightly around the target (`planChunks` merges a too-short trailing
  chunk into the previous one rather than emitting a sliver).
- This is what makes chunk×resolution jobs independently retriable and
  parallelizable across many transcoder replicas (Fase 9) - the coupling
  that would otherwise exist between adjacent chunks (shared encoder
  state) is exactly what independent encoding + `#EXT-X-DISCONTINUITY`
  removes.
