import "reflect-metadata";
import { initTracing } from "@video-streaming/observability";

initTracing({
  serviceName: "stream-api",
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces",
});

import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import type { AppConfig } from "./config/configuration";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle("stream-api").setVersion("1.0").build(),
  );
  SwaggerModule.setup("docs", app, document);

  const config = app.get(ConfigService<AppConfig, true>);
  await app.listen(config.get("port", { infer: true }));
}

bootstrap();
