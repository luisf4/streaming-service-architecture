import type { Observable } from "rxjs";
import { distinctUntilChanged, filter, switchMap, takeWhile } from "rxjs/operators";

export interface StatusPayload {
  status: string;
  manifestKey: string | null;
  failureReason: string | null;
}

const TERMINAL_STATUSES = new Set(["READY", "FAILED"]);

/**
 * Turns a `ticker` (one emission per poll attempt) into a deduplicated
 * status stream that completes once a terminal status is reached - so an
 * SSE client for /videos/:id/events gets one event per real status change
 * and the connection closes itself when there is nothing left to report.
 */
export function createStatusStream(
  poll: () => Promise<StatusPayload | null>,
  ticker: Observable<unknown>,
): Observable<StatusPayload> {
  return ticker.pipe(
    switchMap(() => poll()),
    filter((payload): payload is StatusPayload => payload !== null),
    distinctUntilChanged((a, b) => a.status === b.status),
    takeWhile((payload) => !TERMINAL_STATUSES.has(payload.status), true),
  );
}
