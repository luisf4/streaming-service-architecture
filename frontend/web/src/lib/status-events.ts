import type { StatusEvent } from "./api-types";

/** Subscribes to upload-api's SSE status stream; call the returned function to unsubscribe. */
export function subscribeToStatus(
  url: string,
  onEvent: (status: StatusEvent) => void,
  onError?: () => void,
): () => void {
  const source = new EventSource(url);
  source.onmessage = (event: MessageEvent<string>) => {
    onEvent(JSON.parse(event.data) as StatusEvent);
  };
  source.onerror = () => {
    // EventSource retries transient errors on its own; only report it once
    // the browser has given up and closed the connection for good.
    if (source.readyState === EventSource.CLOSED) {
      onError?.();
    }
  };
  return () => source.close();
}
