import { Controller, Get, Header, Inject } from "@nestjs/common";
import type { MetricsRegistry } from "@video-streaming/observability";
import { METRICS_REGISTRY } from "../tokens";

@Controller()
export class MetricsController {
  constructor(@Inject(METRICS_REGISTRY) private readonly metrics: MetricsRegistry) {}

  @Get("metrics")
  @Header("content-type", "text/plain; version=0.0.4; charset=utf-8")
  getMetrics(): Promise<string> {
    return this.metrics.toPrometheusText();
  }
}
