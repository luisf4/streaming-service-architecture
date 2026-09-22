import { context, propagation, trace, type Context } from "@opentelemetry/api";

export type MessageHeaders = Record<string, unknown>;

/**
 * Injects the current trace context into AMQP message headers so a
 * consumer in another process can continue the same trace - this is what
 * lets a single request be followed end to end (upload-api -> validator ->
 * dispatcher -> transcoder -> aggregator) in Jaeger.
 */
export function injectTraceContext(headers: MessageHeaders = {}, activeContext: Context = context.active()): MessageHeaders {
  const carrier: Record<string, string> = {};
  propagation.inject(activeContext, carrier);
  return { ...headers, ...carrier };
}

/** Extracts a trace context previously injected into message headers by `injectTraceContext`. */
export function extractTraceContext(headers: MessageHeaders = {}): Context {
  const carrier: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      carrier[key] = value;
    }
  }
  return propagation.extract(context.active(), carrier);
}

/** True when the headers carry a valid, sampled trace context (useful for tests/debugging). */
export function hasTraceContext(headers: MessageHeaders = {}): boolean {
  const extracted = extractTraceContext(headers);
  const spanContext = trace.getSpanContext(extracted);
  return Boolean(spanContext && trace.isSpanContextValid(spanContext));
}
