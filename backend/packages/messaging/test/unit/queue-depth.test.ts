import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startQueueDepthPoller } from "../../src/queue-depth";

describe("startQueueDepthPoller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports the message count for every queue on each tick", async () => {
    const checkQueue = vi.fn().mockImplementation((queue: string) =>
      Promise.resolve({ queue, messageCount: queue === "a.q" ? 3 : 5, consumerCount: 0 }),
    );
    const onDepth = vi.fn();

    const poller = startQueueDepthPoller({ checkQueue }, ["a.q", "b.q"], onDepth, 1000);

    await vi.advanceTimersByTimeAsync(1000);

    expect(onDepth).toHaveBeenCalledWith("a.q", 3);
    expect(onDepth).toHaveBeenCalledWith("b.q", 5);

    poller.stop();
  });

  it("keeps polling other queues when one check fails", async () => {
    const checkQueue = vi.fn().mockImplementation((queue: string) =>
      queue === "broken.q" ? Promise.reject(new Error("no such queue")) : Promise.resolve({ messageCount: 1 }),
    );
    const onDepth = vi.fn();

    const poller = startQueueDepthPoller({ checkQueue }, ["broken.q", "ok.q"], onDepth, 1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onDepth).toHaveBeenCalledWith("ok.q", 1);
    expect(onDepth).not.toHaveBeenCalledWith("broken.q", expect.anything());

    poller.stop();
  });

  it("stops polling once stop() is called", async () => {
    const checkQueue = vi.fn().mockResolvedValue({ messageCount: 1 });
    const onDepth = vi.fn();

    const poller = startQueueDepthPoller({ checkQueue }, ["a.q"], onDepth, 1000);
    poller.stop();
    await vi.advanceTimersByTimeAsync(5000);

    expect(onDepth).not.toHaveBeenCalled();
  });
});
