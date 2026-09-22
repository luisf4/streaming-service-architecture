import { context, trace } from "@opentelemetry/api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initTracing, type TracingHandle } from "../../src/tracing";
import { extractTraceContext, hasTraceContext, injectTraceContext } from "../../src/propagation";

describe("trace context over message headers", () => {
  let tracing: TracingHandle;

  beforeAll(() => {
    // initTracing registers the same context manager + propagator a real
    // app gets at boot (NodeTracerProvider.register()'s defaults); nothing
    // needs to be listening at otlpEndpoint for this - failed exports are
    // just dropped.
    tracing = initTracing({ serviceName: "observability-test", otlpEndpoint: "http://127.0.0.1:1/v1/traces" });
  });

  afterAll(async () => {
    await tracing.shutdown();
  });

  it("round-trips a span's context through injectTraceContext/extractTraceContext", () => {
    const tracer = trace.getTracer("test");
    const span = tracer.startSpan("do-work");
    const spanContext = span.spanContext();

    const headers = context.with(trace.setSpan(context.active(), span), () => injectTraceContext());
    span.end();

    expect(headers.traceparent).toContain(spanContext.traceId);
    expect(headers.traceparent).toContain(spanContext.spanId);

    const extracted = extractTraceContext(headers);
    expect(trace.getSpanContext(extracted)?.traceId).toBe(spanContext.traceId);
  });

  it("preserves headers that are not part of the trace context", () => {
    const tracer = trace.getTracer("test");
    const span = tracer.startSpan("do-work");

    const headers = context.with(trace.setSpan(context.active(), span), () =>
      injectTraceContext({ "x-attempt": 1 }),
    );
    span.end();

    expect(headers["x-attempt"]).toBe(1);
  });

  it("reports no trace context for plain headers", () => {
    expect(hasTraceContext({ "x-attempt": 1 })).toBe(false);
  });

  it("reports a valid trace context once injected", () => {
    const tracer = trace.getTracer("test");
    const span = tracer.startSpan("do-work");
    const headers = context.with(trace.setSpan(context.active(), span), () => injectTraceContext());
    span.end();

    expect(hasTraceContext(headers)).toBe(true);
  });
});
