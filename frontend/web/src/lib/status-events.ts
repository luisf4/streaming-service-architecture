import type { StatusEvent } from "./api-types";

/** Subscribes to upload-api's SSE status stream; call the returned function to unsubscribe. */
export function subscribeToStatus(url: string, onEvent: (status: StatusEvent) => void): () => void {
  const source = new EventSource(url);
  source.onmessage = (event: MessageEvent<string>) => {
    onEvent(JSON.parse(event.data) as StatusEvent);
  };
  return () => source.close();
}
