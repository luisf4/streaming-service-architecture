import { describe, expect, it } from "vitest";
import { toJsonSchema } from "../src/json-schema";

describe("toJsonSchema", () => {
  it("produces a JSON Schema document for a registered event", () => {
    const schema = toJsonSchema("video.uploaded") as {
      $schema: string;
      definitions: Record<string, { properties: Record<string, unknown> }>;
    };
    expect(schema.$schema).toBeDefined();
    expect(schema.definitions["video.uploaded"].properties).toHaveProperty("eventType");
  });
});
