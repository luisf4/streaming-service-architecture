import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusView } from "../../src/components/StatusView";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static readonly CLOSED = 2;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  readyState = 0;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
}

describe("StatusView", () => {
  beforeEach(() => {
    FakeEventSource.instances.length = 0;
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an alert once the status stream closes permanently", () => {
    render(<StatusView videoId="v1" />);

    const source = FakeEventSource.instances[0];
    act(() => {
      source.readyState = FakeEventSource.CLOSED;
      source.onerror?.();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/lost connection/i);
  });
});
