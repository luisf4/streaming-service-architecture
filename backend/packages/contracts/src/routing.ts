export const EXCHANGES = {
  videoEvents: "video.events",
  transcodeJobs: "transcode.jobs",
} as const;

export const ROUTING_KEYS = {
  videoUploaded: "video.uploaded",
  videoValidated: "video.validated",
  videoValidationFailed: "video.validation.failed",
  chunkTranscoded: "chunk.transcoded",
  videoTranscodeFailed: "video.transcode.failed",
  videoReady: "video.ready",
  transcodeRequested: "transcode.requested",
} as const;

export const QUEUES = {
  validator: "validator.q",
  dispatcher: "dispatcher.q",
  aggregator: "aggregator.q",
  uploadApiStatus: "upload-api.status.q",
  uploadApiStatusRetry: "upload-api.status.retry.q",
  uploadApiStatusDlq: "upload-api.status.dlq",
  transcode: "transcode.q",
  transcodeRetry: "transcode.retry.q",
  transcodeDlq: "transcode.dlq",
} as const;

export const BINDINGS: Array<{
  exchange: string;
  routingKey: string;
  queue: string;
}> = [
  { exchange: EXCHANGES.videoEvents, routingKey: ROUTING_KEYS.videoUploaded, queue: QUEUES.validator },
  { exchange: EXCHANGES.videoEvents, routingKey: ROUTING_KEYS.videoValidated, queue: QUEUES.dispatcher },
  { exchange: EXCHANGES.videoEvents, routingKey: ROUTING_KEYS.chunkTranscoded, queue: QUEUES.aggregator },
  { exchange: EXCHANGES.videoEvents, routingKey: ROUTING_KEYS.videoReady, queue: QUEUES.uploadApiStatus },
  { exchange: EXCHANGES.videoEvents, routingKey: "video.*.failed", queue: QUEUES.uploadApiStatus },
  { exchange: EXCHANGES.transcodeJobs, routingKey: ROUTING_KEYS.transcodeRequested, queue: QUEUES.transcode },
];
