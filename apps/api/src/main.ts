import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // Aplikacja gościa i panel obsługi stoją pod innym originem niż API.
  // Lista dozwolonych originów pochodzi z konfiguracji — nigdy '*', bo
  // żądania niosą token sesji gościa.
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    allowedHeaders: ['content-type', 'authorization', 'x-guest-token'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  new Logger('bootstrap').log(`kelbroo API na http://localhost:${port}/api`);
}

void bootstrap();
