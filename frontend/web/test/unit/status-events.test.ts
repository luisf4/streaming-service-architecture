import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToStatus } from "../../src/lib/status-events";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static readonly CLOSED = 2;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  url: string;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  emit(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  failTransiently(): void {
    this.readyState = 0;
    this.onerror?.();
  }

  failPermanently(): void {
    this.readyState = FakeEventSource.CLOSED;
    this.onerror?.();
  }
}

describe("subscribeToStatus", () => {
  afterEach(() => {
    FakeEventSource.instances.length = 0;
    vi.unstubAllGlobals();
  });

  it("parses incoming SSE messages and forwards them", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const onEvent = vi.fn();

    subscribeToStatus("http://api.test/videos/v1/events", onEvent);

    expect(FakeEventSource.instances[0].url).toBe("http://api.test/videos/v1/events");

    FakeEventSource.instances[0].emit({ status: "PROCESSING", manifestKey: null, failureReason: null });

    expect(onEvent).toHaveBeenCalledWith({ status: "PROCESSING", manifestKey: null, failureReason: null });
  });

  it("closes the underlying EventSource when unsubscribed", () => {
    vi.stubGlobal("EventSource", FakeEventSource);

    const unsubscribe = subscribeToStatus("http://api.test/videos/v1/events", vi.fn());
    unsubscribe();

    expect(FakeEventSource.instances[0].close).toHaveBeenCalledTimes(1);
  });

  it("does not report an error while the browser is still retrying", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const onError = vi.fn();

    subscribeToStatus("http://api.test/videos/v1/events", vi.fn(), onError);
    FakeEventSource.instances[0].failTransiently();

    expect(onError).not.toHaveBeenCalled();
  });

  it("reports an error once the connection is permanently closed", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const onError = vi.fn();

    subscribeToStatus("http://api.test/videos/v1/events", vi.fn(), onError);
    FakeEventSource.instances[0].failPermanently();

    expect(onError).toHaveBeenCalledTimes(1);
  });
});
