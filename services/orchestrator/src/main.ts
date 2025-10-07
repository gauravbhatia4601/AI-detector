import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { APP_CONFIG } from "./tokens.js";
import type { AppConfig } from "./config.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to bootstrap orchestrator", error);
    process.exitCode = 1;
  });
}
