export const ATTEMPT_HEADER = "x-attempt";
export const FAILURE_REASON_HEADER = "x-failure-reason";

export type Headers = Record<string, unknown> | undefined;

export function getAttempt(headers: Headers): number {
  const raw = headers?.[ATTEMPT_HEADER];
  return typeof raw === "number" ? raw : 0;
}

export function nextAttemptHeaders(headers: Headers): Record<string, unknown> {
  return { ...headers, [ATTEMPT_HEADER]: getAttempt(headers) + 1 };
}

export type RetryAction = "retry" | "dead-letter";

export interface RetryDecision {
  action: RetryAction;
  attempt: number;
}

export function decideRetry(headers: Headers, maxAttempts: number): RetryDecision {
  const attempt = getAttempt(headers) + 1;
  return {
    attempt,
    action: attempt >= maxAttempts ? "dead-letter" : "retry",
  };
}
