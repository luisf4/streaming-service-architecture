import "reflect-metadata";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { MANIFEST_URL_EXPIRY_SEC, MANIFEST_URL_SIGNER, PRISMA_CLIENT } from "./tokens";
import { VideosController } from "./videos/videos.controller";
import { VideosService } from "./videos/videos.service";

/**
 * Only the HTTP surface (controllers + DTOs) matters for the OpenAPI
 * document, so this boots VideosController with stub providers instead of
 * the real AppModule - no Postgres/S3/CloudFront needed to run it.
 */
@Module({
  controllers: [VideosController],
  providers: [
    VideosService,
    { provide: PRISMA_CLIENT, useValue: {} },
    { provide: MANIFEST_URL_SIGNER, useValue: { sign: async () => "" } },
    { provide: MANIFEST_URL_EXPIRY_SEC, useValue: 0 },
  ],
})
class OpenApiModule {}

async function main() {
  const app = await NestFactory.create(OpenApiModule, { logger: false });
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle("stream-api").setVersion("1.0").build(),
  );

  const outPath = resolve(__dirname, "../../../../docs/openapi/stream-api.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();
}

main();
