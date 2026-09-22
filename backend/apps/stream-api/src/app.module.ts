import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createPrismaClient, type PrismaClient } from "@video-streaming/database";
import { createS3Client, StorageClient } from "@video-streaming/storage";
import configuration, { type AppConfig } from "./config/configuration";
import { MANIFEST_URL_EXPIRY_SEC, MANIFEST_URL_SIGNER, PRISMA_CLIENT } from "./tokens";
import { CloudFrontManifestUrlSigner, S3ManifestUrlSigner, type ManifestUrlSigner } from "./videos/manifest-url-signer";
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
    VideosService,
    {
      provide: PRISMA_CLIENT,
      useFactory: (config: ConfigService<AppConfig, true>): PrismaClient =>
        createPrismaClient({
          datasources: { db: { url: config.get("database.url", { infer: true }) } },
        }),
      inject: [ConfigService],
    },
    {
      // Prod (Fase 10): CloudFront signed URLs against the HLS
      // distribution. Local/dev (no CDN configured): plain S3/MinIO
      // presigned GET, same as before.
      provide: MANIFEST_URL_SIGNER,
      useFactory: (config: ConfigService<AppConfig, true>): ManifestUrlSigner => {
        const cdn = config.get("cdn", { infer: true });
        if (cdn) {
          return new CloudFrontManifestUrlSigner(cdn);
        }
        const storage = config.get("storage", { infer: true });
        return new S3ManifestUrlSigner(new StorageClient(createS3Client(storage), storage.hlsBucket));
      },
      inject: [ConfigService],
    },
    {
      provide: MANIFEST_URL_EXPIRY_SEC,
      useFactory: (config: ConfigService<AppConfig, true>): number =>
        config.get("manifestUrlExpirySec", { infer: true }),
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
