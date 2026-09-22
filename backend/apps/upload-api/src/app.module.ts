import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createPrismaClient, type PrismaClient } from "@video-streaming/database";
import { createS3Client, StorageClient } from "@video-streaming/storage";
import { EventPublisher, type ConsumerChannel, type PublishChannel } from "@video-streaming/messaging";
import configuration, { type AppConfig } from "./config/configuration";
import { OutboxRelayService } from "./outbox/outbox-relay.service";
import { RabbitProvider } from "./rabbit/rabbit.provider";
import { StatusConsumerService } from "./status/status-consumer.service";
import { EVENT_PUBLISHER, PRISMA_CLIENT, RABBIT_CHANNEL, RAW_BUCKET, STORAGE_CLIENT } from "./tokens";
import { VideosController } from "./videos/videos.controller";
import { VideosService } from "./videos/videos.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
  ],
  controllers: [VideosController],
  providers: [
    RabbitProvider,
    VideosService,
    OutboxRelayService,
    StatusConsumerService,
    {
      provide: PRISMA_CLIENT,
      useFactory: (config: ConfigService<AppConfig, true>): PrismaClient =>
        createPrismaClient({
          datasources: { db: { url: config.get("database.url", { infer: true }) } },
        }),
      inject: [ConfigService],
    },
    {
      provide: STORAGE_CLIENT,
      useFactory: (config: ConfigService<AppConfig, true>): StorageClient => {
        const storage = config.get("storage", { infer: true });
        return new StorageClient(createS3Client(storage), storage.rawBucket);
      },
      inject: [ConfigService],
    },
    {
      provide: RAW_BUCKET,
      useFactory: (config: ConfigService<AppConfig, true>): string =>
        config.get("storage.rawBucket", { infer: true }),
      inject: [ConfigService],
    },
    {
      provide: RABBIT_CHANNEL,
      useFactory: async (
        rabbit: RabbitProvider,
        config: ConfigService<AppConfig, true>,
      ): Promise<PublishChannel & ConsumerChannel> => {
        const connection = await rabbit.connect(config.get("rabbitmqUrl", { infer: true }));
        return connection.channel;
      },
      inject: [RabbitProvider, ConfigService],
    },
    {
      provide: EVENT_PUBLISHER,
      useFactory: (channel: PublishChannel): EventPublisher => new EventPublisher(channel),
      inject: [RABBIT_CHANNEL],
    },
  ],
})
export class AppModule {}
