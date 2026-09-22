import { z } from "zod";

export function eventEnvelope<
  Type extends string,
  Version extends number,
  DataSchema extends z.ZodTypeAny,
>(eventType: Type, eventVersion: Version, data: DataSchema) {
  return z.object({
    eventId: z.string().uuid(),
    eventType: z.literal(eventType),
    eventVersion: z.literal(eventVersion),
    occurredAt: z.string().datetime(),
    correlationId: z.string().uuid(),
    data,
  });
}

export type EventEnvelope<DataSchema extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof eventEnvelope<string, number, DataSchema>>
>;
