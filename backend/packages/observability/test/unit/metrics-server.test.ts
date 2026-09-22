import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { MetricsRegistry } from "../../src/metrics";
import { startMetricsServer, type MetricsServerHandle } from "../../src/metrics-server";

function get(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}${path}`, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      })
      .on("error", reject);
  });
}

describe("startMetricsServer", () => {
  let handle: MetricsServerHandle | undefined;

  afterEach(async () => {
    await handle?.close();
    handle = undefined;
  });

  it("serves the registry's Prometheus text on GET /metrics", async () => {
    const metrics = new MetricsRegistry();
    metrics.setQueueDepth("transcode.q", 7);
    handle = await startMetricsServer(metrics, 0);
    const port = (handle.server.address() as { port: number }).port;

    const response = await get(port, "/metrics");

    expect(response.status).toBe(200);
    expect(response.body).toContain('streaming_queue_depth{queue="transcode.q"} 7');
  });

  it("404s any other path", async () => {
    handle = await startMetricsServer(new MetricsRegistry(), 0);
    const port = (handle.server.address() as { port: number }).port;

    const response = await get(port, "/other");

    expect(response.status).toBe(404);
  });
});
