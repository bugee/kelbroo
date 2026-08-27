import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AlertsService } from '../alerts/alerts.service';
import { HealthWatchdogService } from '../alerts/health-watchdog.service';

interface Odpowiedz {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  redis: 'up' | 'down';
  /** Klucze trwających alarmów — po nich widać, co dokładnie jest zepsute. */
  alerts: string[];
}

/**
 * Punkt, w który puka monitor.
 *
 * **Kod odpowiedzi jest tu ważniejszy od treści.** Wcześniej ten adres zwracał
 * `200` także przy padniętej bazie, z `degraded` w środku — a monitor patrzy na
 * kod, nie czyta JSON-a. Sprawny wynik przy zepsutej usłudze jest gorszy niż brak
 * monitorowania, bo daje fałszywy spokój.
 *
 * Adres jest publiczny i celowo nie mówi nic ponad to, co żywe: nazwy usług
 * i klucze alarmów. Żadnych wersji, adresów ani treści błędów.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly watchdog: HealthWatchdogService,
    private readonly alerts: AlertsService,
  ) {}

  @Get()
  async check(@Res({ passthrough: true }) response: Response): Promise<Odpowiedz> {
    const stan = await this.watchdog.zbadaj();
    const sprawne = stan.baza === 'up' && stan.redis === 'up';

    response.status(sprawne ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: sprawne ? 'ok' : 'degraded',
      database: stan.baza,
      redis: stan.redis,
      alerts: this.alerts.trwajace,
    };
  }
}
