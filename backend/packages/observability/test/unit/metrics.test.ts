import { describe, expect, it } from "vitest";
import { MetricsRegistry } from "../../src/metrics";

describe("MetricsRegistry", () => {
  it("exposes queue depth per queue", async () => {
    const metrics = new MetricsRegistry();

    metrics.setQueueDepth("transcode.q", 42);
    metrics.setQueueDepth("validator.q", 0);

    const text = await metrics.toPrometheusText();
    expect(text).toContain('streaming_queue_depth{queue="transcode.q"} 42');
    expect(text).toContain('streaming_queue_depth{queue="validator.q"} 0');
  });

  it("counts jobs by service and outcome", async () => {
    const metrics = new MetricsRegistry();

    metrics.recordJob("transcoder", "success");
    metrics.recordJob("transcoder", "success");
    metrics.recordJob("transcoder", "dead-letter");

    const text = await metrics.toPrometheusText();
    expect(text).toContain('streaming_jobs_total{service="transcoder",outcome="success"} 2');
    expect(text).toContain('streaming_jobs_total{service="transcoder",outcome="dead-letter"} 1');
  });

  it("observes job duration when given", async () => {
    const metrics = new MetricsRegistry();

    metrics.recordJob("transcoder", "success", 1.5);

    const text = await metrics.toPrometheusText();
    expect(text).toContain("streaming_job_duration_seconds_sum");
    expect(text).toContain('streaming_job_duration_seconds_count{service="transcoder"} 1');
  });

  it("does not observe a duration when none is given", async () => {
    const metrics = new MetricsRegistry();

    metrics.recordJob("validator", "success");

    const text = await metrics.toPrometheusText();
    expect(text).not.toContain("streaming_job_duration_seconds_count");
  });

  it("exposes the content type prom-client expects on the /metrics response", () => {
    const metrics = new MetricsRegistry();
    expect(metrics.contentType).toContain("text/plain");
  });
});
