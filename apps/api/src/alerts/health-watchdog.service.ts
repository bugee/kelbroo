import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from './alerts.service';

export interface StanUslugi {
  baza: 'up' | 'down';
  redis: 'up' | 'down';
}

/** Sonda ma odpowiedzieć albo zamilknąć — zawieszona nie jest wynikiem. */
const LIMIT_SONDY_MS = 3_000;

/**
 * Czujnik dwóch rzeczy, których awaria nie przewraca API, tylko psuje je po cichu.
 *
 * **Baza** — bez niej nie działa nic, ale proces stoi i odpowiada na żądania
 * błędami. Z zewnątrz wygląda jak działający serwer.
 *
 * **Redis** — najgorszy przypadek z całego systemu, bo najmniej widoczny.
 * Gdy padnie, panel przestaje dostawać zdarzenia na żywo: kelner nie widzi
 * nowego zamówienia, ekran kuchni nie odświeża się sam. Nikt nie zobaczy błędu,
 * bo błędu nie ma — jest cisza, którą obsługa weźmie za brak zamówień.
 *
 * Czego czujnik nie wykryje: własnej śmierci. Gdy proces nie żyje, nie ma go kto
 * uruchomić — od tego jest monitor spoza maszyny (docs/todo.md §7).
 */
@Injectable()
export class HealthWatchdogService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthWatchdogService.name);
  private redis: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  /**
   * Sam pomiar, bez alarmowania.
   *
   * Rozdzielone celowo: `/api/health` ma **zmierzyć i odpowiedzieć**, a nie
   * wysyłać pocztę przy każdym pytaniu monitora. Alarmuje wyłącznie przebieg
   * cykliczny niżej.
   */
  async zbadaj(): Promise<StanUslugi> {
    const [baza, redis] = await Promise.all([this.sondaBazy(), this.sondaRedisa()]);
    return { baza, redis };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async dozor(): Promise<void> {
    const stan = await this.zbadaj();

    await this.rozstrzygnij('baza', stan.baza, {
      temat: 'Baza danych nie odpowiada',
      opis:
        'API nie wykonuje zapytań do PostgreSQL. Zamawianie, panel i aplikacja gościa ' +
        'są w tej chwili niedostępne, mimo że serwer odpowiada na żądania.',
    });

    await this.rozstrzygnij('redis', stan.redis, {
      temat: 'Redis nie odpowiada',
      opis:
        'Zdarzenia na żywo przestały docierać do paneli. Zamówienia wciąż się zapisują, ' +
        'ale kelner i kuchnia <strong>nie zobaczą nowych bez odświeżenia strony</strong> — ' +
        'a nie dostaną o tym żadnego komunikatu.',
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }

  private async rozstrzygnij(
    co: 'baza' | 'redis',
    stan: 'up' | 'down',
    tresc: { temat: string; opis: string },
  ): Promise<void> {
    const klucz = `usluga.${co}`;
    if (stan === 'down') {
      await this.alerts.zglos({ klucz, temat: tresc.temat, akapity: [tresc.opis], waga: 'awaria' });
      return;
    }
    await this.alerts.ustapilo(klucz, `${tresc.temat} — już odpowiada`, [
      'Sonda znów dostaje odpowiedź. Warto sprawdzić w logu, co było przyczyną.',
    ]);
  }

  private async sondaBazy(): Promise<'up' | 'down'> {
    try {
      await this.zLimitem(this.prisma.$queryRaw`SELECT 1`);
      return 'up';
    } catch (przyczyna) {
      this.logger.error(`Sonda bazy: ${String(przyczyna)}`);
      return 'down';
    }
  }

  private async sondaRedisa(): Promise<'up' | 'down'> {
    try {
      await this.zLimitem(this.pingRedisa());
      return 'up';
    } catch (przyczyna) {
      this.logger.error(`Sonda Redisa: ${String(przyczyna)}`);
      return 'down';
    }
  }

  /**
   * Ping z jawnym nawiązaniem połączenia.
   *
   * Bez tego pierwsza sonda po starcie zgłaszała **fałszywą awarię**: przy
   * `lazyConnect` gniazdo jeszcze nie stoi, a wyłączona kolejka offline odrzuca
   * polecenie od razu. Fałszywy alarm jest gorszy od braku alarmu — po drugim
   * takim nikt nie czyta trzeciego.
   *
   * `connect()` wołamy wyłącznie z dwóch stanów spoczynku. Gdy klient sam się
   * wznawia (`reconnecting`, `close`), Redis naprawdę nie odpowiada i `ping`
   * ma polec — a `connect()` rzuciłby wtedy „already connecting".
   */
  private async pingRedisa(): Promise<void> {
    const klient = this.polaczenie();
    if (klient.status === 'wait' || klient.status === 'end') {
      await klient.connect();
    }
    await klient.ping();
  }

  /**
   * Połączenie sondy, osobne od tego, którym chodzi realtime.
   *
   * `lazyConnect` i brak ponawiania w nieskończoność są tu istotne: sonda ma
   * **odpowiedzieć „nie żyje"**, a nie stać w kolejce ponowień i nie odpowiedzieć
   * wcale. Reszcie systemu ponowienia się przydają — tej jednej ścieżce szkodzą.
   */
  private polaczenie(): Redis {
    if (!this.redis) {
      this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: () => 1_000,
      });
      // Bez tego zerwane połączenie kończy się nieobsłużonym zdarzeniem `error`,
      // które w Node wywraca proces — czujnik zabiłby to, czego pilnuje.
      this.redis.on('error', (blad) => this.logger.debug(`Redis (sonda): ${blad.message}`));
    }
    return this.redis;
  }

  private zLimitem<T>(obietnica: PromiseLike<T>): Promise<T> {
    return Promise.race([
      Promise.resolve(obietnica),
      new Promise<never>((_, odrzuc) =>
        setTimeout(() => odrzuc(new Error('sonda nie odpowiedziała')), LIMIT_SONDY_MS).unref(),
      ),
    ]);
  }
}
