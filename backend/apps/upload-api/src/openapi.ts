import "reflect-metadata";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { PRISMA_CLIENT, RAW_BUCKET, STORAGE_CLIENT } from "./tokens";
import { VideosController } from "./videos/videos.controller";
import { VideosService } from "./videos/videos.service";

/**
 * Only the HTTP surface (controllers + DTOs) matters for the OpenAPI
 * document, so this boots VideosController with stub providers instead of
 * the real AppModule - no Postgres/S3/RabbitMQ needed to run it.
 */
@Module({
  controllers: [VideosController],
  providers: [
    VideosService,
    { provide: PRISMA_CLIENT, useValue: {} },
    { provide: STORAGE_CLIENT, useValue: {} },
    { provide: RAW_BUCKET, useValue: "" },
  ],
})
class OpenApiModule {}

async function main() {
  const app = await NestFactory.create(OpenApiModule, { logger: false });
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle("upload-api").setVersion("1.0").build(),
  );

  const outPath = resolve(__dirname, "../../../../docs/openapi/upload-api.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();
}

main();
