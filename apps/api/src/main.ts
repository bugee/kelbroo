import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
import { DomainExceptionFilter } from './common/domain-exception.filter';

async function bootstrap(): Promise<void> {
  // `rawBody` jest potrzebne wyłącznie powiadomieniom od operatora płatności:
  // podpis liczy się z dokładnie tych bajtów, które przyszły, więc ponowne
  // złożenie JSON-a z obiektu nigdy by się nie zgodziło.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix('api');

  // Wszystkie cztery aplikacje stoją lokalnie pod innym originem niż API.
  // Lista dozwolonych originów pochodzi z konfiguracji — nigdy '*', bo
  // żądania niosą token sesji gościa i token zaplecza.
  //
  // Wartość domyślna obejmuje komplet portów deweloperskich. Brak któregoś
  // objawia się w przeglądarce jako „Failed to fetch" — błąd sieciowy bez
  // odpowiedzi serwera, więc przyczyny nie widać ani w logu API, ani na ekranie.
  app.enableCors({
    origin: (
      process.env.CORS_ORIGINS ??
      'http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    allowedHeaders: ['content-type', 'authorization', 'x-guest-token'],
    credentials: true,
  });
  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  const realtime = new RedisIoAdapter(app);
  await realtime.connect();
  app.useWebSocketAdapter(realtime);

  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  new Logger('bootstrap').log(`kelbroo API na http://localhost:${port}/api`);
}

void bootstrap();
