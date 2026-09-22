import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToStatus } from "../../src/lib/status-events";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  close = vi.fn();
  url: string;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  emit(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) });
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
});
