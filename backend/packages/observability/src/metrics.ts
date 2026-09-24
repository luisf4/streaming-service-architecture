import { Counter, Gauge, Histogram, Registry } from "prom-client";

export type JobOutcome = "success" | "retry" | "dead-letter";

/**
 * The four numbers the plan calls out explicitly (Fase 8): queue depth,
 * jobs/s, time per chunk, and DLQ rate. `jobsTotal` (by outcome) gives
 * jobs/s and DLQ rate as PromQL rate()s over the same counter; the rest are
 * their own metric.
 */
export class MetricsRegistry {
  readonly registry = new Registry();

  readonly queueDepth = new Gauge({
    name: "streaming_queue_depth",
    help: "Number of ready messages in a queue",
    labelNames: ["queue"],
    registers: [this.registry],
  });

  readonly jobsTotal = new Counter({
    name: "streaming_jobs_total",
    help: "Jobs processed by a consumer, by outcome",
    labelNames: ["service", "outcome"],
    registers: [this.registry],
  });

  readonly jobDurationSeconds = new Histogram({
    name: "streaming_job_duration_seconds",
    help: "Time spent processing one job (e.g. one chunk transcode)",
    labelNames: ["service"],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
    registers: [this.registry],
  });

  /** Wall-clock time from a video's creation (UPLOADING) to it reaching READY. */
  readonly videoTotalDurationSeconds = new Histogram({
    name: "streaming_video_total_duration_seconds",
    help: "Time from a video being created to its status reaching READY",
    buckets: [5, 10, 30, 60, 120, 300, 600, 1800, 3600],
    registers: [this.registry],
  });

  recordJob(service: string, outcome: JobOutcome, durationSeconds?: number): void {
    this.jobsTotal.inc({ service, outcome });
    if (durationSeconds !== undefined) {
      this.jobDurationSeconds.observe({ service }, durationSeconds);
    }
  }

  recordVideoReady(createdAt: Date): void {
    this.videoTotalDurationSeconds.observe((Date.now() - createdAt.getTime()) / 1000);
  }

  setQueueDepth(queue: string, depth: number): void {
    this.queueDepth.set({ queue }, depth);
  }

  async toPrometheusText(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
