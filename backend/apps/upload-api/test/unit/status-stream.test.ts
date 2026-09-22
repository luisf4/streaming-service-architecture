import { Subject, firstValueFrom } from "rxjs";
import { toArray } from "rxjs/operators";
import { describe, expect, it, vi } from "vitest";
import { createStatusStream, type StatusPayload } from "../../src/status/status-stream";

function payload(status: string): StatusPayload {
  return { status, manifestKey: null, failureReason: null };
}

describe("createStatusStream", () => {
  it("emits one event per poll tick", async () => {
    const ticker = new Subject<void>();
    const poll = vi.fn().mockResolvedValueOnce(payload("UPLOADING")).mockResolvedValueOnce(payload("PROCESSING"));

    const collected = firstValueFrom(createStatusStream(poll, ticker).pipe(toArray()));

    ticker.next();
    await Promise.resolve();
    ticker.next();
    ticker.complete();

    expect(await collected).toEqual([payload("UPLOADING"), payload("PROCESSING")]);
  });

  it("skips consecutive ticks that report the same status", async () => {
    const ticker = new Subject<void>();
    const poll = vi
      .fn()
      .mockResolvedValueOnce(payload("PROCESSING"))
      .mockResolvedValueOnce(payload("PROCESSING"))
      .mockResolvedValueOnce(payload("READY"));

    const collected = firstValueFrom(createStatusStream(poll, ticker).pipe(toArray()));

    ticker.next();
    await Promise.resolve();
    ticker.next();
    await Promise.resolve();
    ticker.next();

    expect(await collected).toEqual([payload("PROCESSING"), payload("READY")]);
  });

  it("completes the stream right after a terminal status (READY or FAILED)", async () => {
    const ticker = new Subject<void>();
    const poll = vi.fn().mockResolvedValueOnce(payload("READY")).mockResolvedValueOnce(payload("READY"));
    let completed = false;

    const sub = createStatusStream(poll, ticker).subscribe({ complete: () => (completed = true) });

    ticker.next();
    await Promise.resolve();
    expect(completed).toBe(true);

    // further ticks are ignored - the subscription already closed itself
    ticker.next();
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(1);

    sub.unsubscribe();
  });

  it("ignores a tick where the video is not found yet", async () => {
    const ticker = new Subject<void>();
    const poll = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(payload("UPLOADING"));

    const collected = firstValueFrom(createStatusStream(poll, ticker).pipe(toArray()));

    ticker.next();
    await Promise.resolve();
    ticker.next();
    ticker.complete();

    expect(await collected).toEqual([payload("UPLOADING")]);
  });
});
