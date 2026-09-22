import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { assertTopology, connectRabbitMQ, type RabbitConnection } from "@video-streaming/messaging";

@Injectable()
export class RabbitProvider implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitProvider.name);
  private connection?: RabbitConnection;
  private connecting?: Promise<RabbitConnection>;

  async connect(url: string): Promise<RabbitConnection> {
    if (this.connection) return this.connection;
    if (!this.connecting) {
      this.connecting = (async () => {
        const connection = await connectRabbitMQ(url);
        await assertTopology(connection.channel);
        this.connection = connection;
        return connection;
      })();
    }
    return this.connecting;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.connection?.close();
    } catch (error) {
      this.logger.warn("failed to close RabbitMQ connection cleanly", error as Error);
    }
  }
}
