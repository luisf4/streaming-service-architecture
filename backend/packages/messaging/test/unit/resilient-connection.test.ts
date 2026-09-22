import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { connectWithRetry } from "../../src/resilient-connection";
import type { RabbitConnection } from "../../src/connection";

function fakeRabbitConnection(): RabbitConnection & { connection: EventEmitter } {
  const emitter = new EventEmitter();
  return {
    connection: emitter as never,
    channel: {} as never,
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe("connectWithRetry", () => {
  it("calls onReady once a successful connection is made", async () => {
    const rabbit = fakeRabbitConnection();
    const connect = vi.fn().mockResolvedValue(rabbit);
    const onReady = vi.fn().mockResolvedValue(undefined);

    await connectWithRetry({ url: "amqp://x", connect, onReady, sleep: vi.fn() });

    expect(connect).toHaveBeenCalledWith("amqp://x");
    expect(onReady).toHaveBeenCalledWith(rabbit);
  });

  it("retries with backoff until connect succeeds", async () => {
    const rabbit = fakeRabbitConnection();
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error("refused"))
      .mockRejectedValueOnce(new Error("refused"))
      .mockResolvedValueOnce(rabbit);
    const onReady = vi.fn().mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onReconnecting = vi.fn();

    await connectWithRetry({
      url: "amqp://x",
      connect,
      onReady,
      sleep,
      onReconnecting,
      initialDelayMs: 100,
    });

    expect(connect).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
    expect(onReconnecting).toHaveBeenCalledTimes(2);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("caps the backoff delay at maxDelayMs", async () => {
    const rabbit = fakeRabbitConnection();
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error("x"))
      .mockRejectedValueOnce(new Error("x"))
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValueOnce(rabbit);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await connectWithRetry({
      url: "amqp://x",
      connect,
      onReady: vi.fn().mockResolvedValue(undefined),
      sleep,
      initialDelayMs: 1000,
      maxDelayMs: 1500,
    });

    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 1500, 1500]);
  });

  it("reconnects and calls onReady again when the connection unexpectedly closes", async () => {
    const first = fakeRabbitConnection();
    const second = fakeRabbitConnection();
    const connect = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const onReady = vi.fn().mockResolvedValue(undefined);

    await connectWithRetry({ url: "amqp://x", connect, onReady, sleep: vi.fn() });
    expect(onReady).toHaveBeenCalledTimes(1);

    first.connection.emit("close");
    // reconnect is fire-and-forget from the close handler; flush microtasks.
    await Promise.resolve();
    await Promise.resolve();

    expect(connect).toHaveBeenCalledTimes(2);
    expect(onReady).toHaveBeenNthCalledWith(2, second);
  });

  it("does not reconnect after close() was called deliberately", async () => {
    const rabbit = fakeRabbitConnection();
    const connect = vi.fn().mockResolvedValue(rabbit);
    const onReady = vi.fn().mockResolvedValue(undefined);

    const handle = await connectWithRetry({ url: "amqp://x", connect, onReady, sleep: vi.fn() });
    await handle.close();

    rabbit.connection.emit("close");
    await Promise.resolve();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(rabbit.close).toHaveBeenCalledTimes(1);
  });
});
