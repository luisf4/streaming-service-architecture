import { connectRabbitMQ, type RabbitConnection } from "./connection";

export interface ResilientConnectionOptions {
  url: string;
  /** Called after every (re)connect - assert topology and (re)start consumers/publishers against the new channel. */
  onReady: (rabbit: RabbitConnection) => Promise<void>;
  onReconnecting?: (attempt: number, delayMs: number, error: unknown) => void;
  initialDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  connect?: (url: string) => Promise<RabbitConnection>;
}

export interface ResilientConnectionHandle {
  close: () => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Keeps a RabbitMQ connection alive across broker restarts: on an
 * unexpected close/error it reconnects with exponential backoff and calls
 * `onReady` again so the caller can re-assert topology and restart its
 * consumers against the new channel. This is what lets a worker survive
 * `docker kill rabbitmq` in the Fase 9 chaos drill instead of staying dead.
 */
export async function connectWithRetry(options: ResilientConnectionOptions): Promise<ResilientConnectionHandle> {
  const sleep = options.sleep ?? defaultSleep;
  const connect = options.connect ?? connectRabbitMQ;
  const initialDelayMs = options.initialDelayMs ?? 1_000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;

  let closing = false;
  let current: RabbitConnection | undefined;

  async function connectLoop(): Promise<void> {
    let delay = initialDelayMs;
    let attempt = 0;

    while (!closing) {
      try {
        const rabbit = await connect(options.url);
        current = rabbit;

        const onDrop = () => {
          if (closing) return;
          void connectLoop();
        };
        rabbit.connection.on("close", onDrop);
        rabbit.connection.on("error", () => {
          // "close" always follows "error" for amqplib connections; avoid double-triggering.
        });

        await options.onReady(rabbit);
        return;
      } catch (error) {
        attempt += 1;
        options.onReconnecting?.(attempt, delay, error);
        await sleep(delay);
        delay = Math.min(delay * 2, maxDelayMs);
      }
    }
  }

  await connectLoop();

  return {
    close: async () => {
      closing = true;
      await current?.close();
    },
  };
}
