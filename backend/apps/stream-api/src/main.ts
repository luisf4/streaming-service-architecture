import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import type { AppConfig } from "./config/configuration";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
