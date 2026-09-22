import { describe, expect, it } from "vitest";
import { initTracing } from "../../src/tracing";

describe("initTracing", () => {
  it("registers a tracer provider and can be shut down cleanly", async () => {
    const handle = initTracing({ serviceName: "test-service", otlpEndpoint: "http://127.0.0.1:1/v1/traces" });

    await expect(handle.shutdown()).resolves.toBeUndefined();
  });
});
