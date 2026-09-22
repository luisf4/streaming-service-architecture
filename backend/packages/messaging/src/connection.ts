import amqp from "amqplib";
import type { Channel, ChannelModel } from "amqplib";

export interface RabbitConnection {
  connection: ChannelModel;
  channel: Channel;
  close(): Promise<void>;
}

export async function connectRabbitMQ(url: string): Promise<RabbitConnection> {
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();
  return {
    connection,
    channel,
    async close() {
      await channel.close();
      await connection.close();
    },
  };
}
