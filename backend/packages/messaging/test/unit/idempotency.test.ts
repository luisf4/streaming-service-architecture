import { describe, expect, it } from "vitest";
import { InMemoryIdempotencyStore } from "../../src/idempotency";

describe("InMemoryIdempotencyStore", () => {
  it("reports an event as not processed before it is marked", async () => {
    const store = new InMemoryIdempotencyStore();
    expect(await store.hasProcessed("evt-1")).toBe(false);
  });

  it("reports an event as processed after it is marked", async () => {
    const store = new InMemoryIdempotencyStore();
    await store.markProcessed("evt-1");
    expect(await store.hasProcessed("evt-1")).toBe(true);
  });

  it("keeps events independent of each other", async () => {
    const store = new InMemoryIdempotencyStore();
    await store.markProcessed("evt-1");
    expect(await store.hasProcessed("evt-2")).toBe(false);
  });
});
