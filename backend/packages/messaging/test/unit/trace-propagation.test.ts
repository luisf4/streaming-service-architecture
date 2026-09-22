import { context, propagation, trace, TraceFlags } from "@opentelemetry/api";
import { AsyncHooksContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import type { ConsumeMessage } from "amqplib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EventConsumer, type ConsumerOptions } from "../../src/consumer";
import { EventPublisher } from "../../src/publisher";
import { InMemoryIdempotencyStore } from "../../src/idempotency";

const SPAN_CONTEXT = {
  traceId: "0102030405060708090a0b0c0d0e0f10",
  spanId: "0102030405060708",
  traceFlags: TraceFlags.SAMPLED,
  isRemote: false,
};

function options(): ConsumerOptions {
  return {
    queue: "validator.q",
    retryExchange: "video.events",
    retryRoutingKey: "video.uploaded.retry",
    dlqExchange: "video.events",
    dlqRoutingKey: "video.uploaded.dead",
    maxAttempts: 3,
  };
}

describe("trace context propagation over AMQP headers", () => {
  // A real app registers these via observability's initTracing() at boot
  // (NodeTracerProvider.register() sets up both); tests register them
  // directly to exercise the same inject/extract path.
  let contextManager: AsyncHooksContextManager;

  beforeAll(() => {
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    contextManager = new AsyncHooksContextManager().enable();
    context.setGlobalContextManager(contextManager);
  });

  afterAll(() => {
    propagation.disable();
    contextManager.disable();
    context.disable();
  });

  it("EventPublisher injects the active span context into message headers", () => {
    const publish = vi.fn().mockReturnValue(true);
    const publisher = new EventPublisher({ publish });
    const activeContext = trace.setSpan(context.active(), trace.wrapSpanContext(SPAN_CONTEXT));

    context.with(activeContext, () => {
      publisher.publish("video.events", "video.uploaded", { hello: "world" });
    });

    const headers = publish.mock.calls[0][3].headers as Record<string, string>;
    expect(headers.traceparent).toContain(SPAN_CONTEXT.traceId);
    expect(headers.traceparent).toContain(SPAN_CONTEXT.spanId);
  });

  it("EventConsumer runs the handler inside the trace context carried in the headers", async () => {
    const channel = { ack: vi.fn(), nack: vi.fn(), publish: vi.fn(), prefetch: vi.fn(), consume: vi.fn(), cancel: vi.fn() };
    const consumer = new EventConsumer(channel, new InMemoryIdempotencyStore());

    // Build the headers the way EventPublisher would.
    const headers: Record<string, string> = {};
    context.with(trace.setSpan(context.active(), trace.wrapSpanContext(SPAN_CONTEXT)), () => {
      const publisher = new EventPublisher({
        publish: (_e, _r, _c, opts) => {
          Object.assign(headers, opts?.headers);
          return true;
        },
      });
      publisher.publish("video.events", "video.uploaded", {});
    });

    const msg = {
      content: Buffer.from(JSON.stringify({ eventId: "evt-1" })),
      fields: {} as ConsumeMessage["fields"],
      properties: { headers } as ConsumeMessage["properties"],
    };

    let observedSpanContext: ReturnType<typeof trace.getSpanContext>;
    await consumer.handleMessage(msg, options(), async () => {
      observedSpanContext = trace.getSpanContext(context.active());
    });

    expect(observedSpanContext?.traceId).toBe(SPAN_CONTEXT.traceId);
    expect(observedSpanContext?.spanId).toBe(SPAN_CONTEXT.spanId);
  });
});
