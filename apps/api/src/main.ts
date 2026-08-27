import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
import { DomainExceptionFilter } from './common/domain-exception.filter';
import { AlertsService } from './alerts/alerts.service';

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

  // Sieć bezpieczeństwa pod dozorem zadań cyklicznych: łapie to, czego nikt nie
  // objął `AlertsService.pilnuj` — odrzuconą obietnicę bez `catch` gdziekolwiek
  // w procesie. Nowsze wersje Node kończą wtedy proces, więc bez tej linii
  // pojedynczy przeoczony `await` potrafi wyłączyć API po cichu.
  const alerts = app.get(AlertsService);
  process.on('unhandledRejection', (przyczyna) => {
    const opis = przyczyna instanceof Error ? przyczyna.message : String(przyczyna);
    void alerts.zglos({
      klucz: 'proces.nieobsluzony-blad',
      temat: 'Nieobsłużony błąd w API',
      akapity: [
        `W procesie API powstała odrzucona obietnica bez obsługi: <code>${opis}</code>`,
        'To błąd programistyczny, nie awaria infrastruktury. Ślad stosu jest w logu API.',
      ],
      waga: 'awaria',
    });
  });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  new Logger('bootstrap').log(`kelbroo API na http://localhost:${port}/api`);
}

void bootstrap();
