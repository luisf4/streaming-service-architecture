import { zodToJsonSchema } from "zod-to-json-schema";
import { EVENT_SCHEMAS, type EventType } from "./registry";

// zod-to-json-schema's generic signature blows up TS's instantiation depth
// against our envelope types, so we cross the boundary through `never`
// (always assignable) rather than fight the type checker; runtime behavior
// is covered by test/json-schema.test.ts.
export function toJsonSchema(eventType: EventType): Record<string, unknown> {
  return zodToJsonSchema(EVENT_SCHEMAS[eventType] as never, eventType) as Record<
    string,
    unknown
  >;
}
