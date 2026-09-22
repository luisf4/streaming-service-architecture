import { describe, expect, it } from "vitest";
import { ATTEMPT_HEADER, decideRetry, getAttempt, nextAttemptHeaders } from "../../src/retry";

describe("retry helpers", () => {
  it("treats a message with no headers as attempt 0", () => {
    expect(getAttempt(undefined)).toBe(0);
  });

  it("reads the attempt count from headers", () => {
    expect(getAttempt({ [ATTEMPT_HEADER]: 2 })).toBe(2);
  });

  it("increments the attempt count for the next try", () => {
    const headers = nextAttemptHeaders({ [ATTEMPT_HEADER]: 1 });
    expect(headers[ATTEMPT_HEADER]).toBe(2);
  });

  it("decides to retry while under maxAttempts", () => {
    const decision = decideRetry({ [ATTEMPT_HEADER]: 0 }, 3);
    expect(decision).toEqual({ action: "retry", attempt: 1 });
  });

  it("decides to dead-letter once maxAttempts is reached", () => {
    const decision = decideRetry({ [ATTEMPT_HEADER]: 2 }, 3);
    expect(decision).toEqual({ action: "dead-letter", attempt: 3 });
  });
});
