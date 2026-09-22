export interface IdempotencyStore {
  hasProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly seen = new Set<string>();

  async hasProcessed(eventId: string): Promise<boolean> {
    return this.seen.has(eventId);
  }

  async markProcessed(eventId: string): Promise<void> {
    this.seen.add(eventId);
  }
}
