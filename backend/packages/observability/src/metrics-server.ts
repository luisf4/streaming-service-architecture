import http, { type Server } from "node:http";
import type { MetricsRegistry } from "./metrics";

export interface MetricsServerHandle {
  server: Server;
  close: () => Promise<void>;
}

/** Minimal HTTP server exposing GET /metrics for Prometheus to scrape - no framework needed for one route. */
export function startMetricsServer(metrics: MetricsRegistry, port: number): Promise<MetricsServerHandle> {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/metrics") {
      metrics
        .toPrometheusText()
        .then((text) => {
          res.writeHead(200, { "content-type": metrics.contentType });
          res.end(text);
        })
        .catch((error) => {
          res.writeHead(500);
          res.end(String(error));
        });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      resolve({
        server,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}
