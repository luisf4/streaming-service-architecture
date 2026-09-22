import { describe, expect, it, vi } from "vitest";
import { EventPublisher } from "../../src/publisher";

describe("EventPublisher", () => {
  it("serializes the event and publishes it as a persistent JSON message", () => {
    const publish = vi.fn().mockReturnValue(true);
    const publisher = new EventPublisher({ publish });

    publisher.publish("video.events", "video.uploaded", { hello: "world" });

    expect(publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, content, options] = publish.mock.calls[0];
    expect(exchange).toBe("video.events");
    expect(routingKey).toBe("video.uploaded");
    expect(JSON.parse(content.toString())).toEqual({ hello: "world" });
    expect(options).toMatchObject({ persistent: true, contentType: "application/json" });
  });

  it("forwards custom headers", () => {
    const publish = vi.fn().mockReturnValue(true);
    const publisher = new EventPublisher({ publish });

    publisher.publish("x", "y", {}, { headers: { "x-attempt": 1 } });

    const options = publish.mock.calls[0][3];
    expect(options.headers).toEqual({ "x-attempt": 1 });
  });

  it("throws when the channel reports its write buffer is full", () => {
    const publish = vi.fn().mockReturnValue(false);
    const publisher = new EventPublisher({ publish });

    expect(() => publisher.publish("x", "y", {})).toThrow(/write buffer full/);
  });
});
