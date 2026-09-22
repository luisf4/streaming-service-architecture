import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export interface TracingOptions {
  serviceName: string;
  otlpEndpoint?: string;
}

export interface TracingHandle {
  shutdown: () => Promise<void>;
}

/**
 * Starts a NodeTracerProvider exporting spans to Jaeger (or any OTLP
 * collector) via HTTP. Each app calls this once at boot with its own
 * service name, then messaging's inject/extractTraceContext carries the
 * trace across process boundaries through message headers.
 */
export function initTracing(options: TracingOptions): TracingHandle {
  const exporter = new OTLPTraceExporter({
    url: options.otlpEndpoint ?? "http://localhost:4318/v1/traces",
  });

  const provider = new NodeTracerProvider({
    resource: new Resource({ [ATTR_SERVICE_NAME]: options.serviceName }),
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });

  provider.register();

  return {
    shutdown: () => provider.shutdown(),
  };
}
