import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { subscriptionActive } from '../common/subscription';

const DZIEN = 24 * 60 * 60 * 1000;

export interface KlientPlatformy {
  organizationId: string;
  nazwa: string;
  nip: string | null;
  emailRozliczeniowy: string;
  zalozone: Date;
  /** Zgody z rejestracji — konta zakładane wcześniej ich nie mają. */
  regulaminZaakceptowany: Date | null;
  plan: string | null;
  status: string;
  /** `true` dla okresu próbnego — najczęstsze pytanie o tę listę. */
  demo: boolean;
  aktywny: boolean;
  aktywnyDo: Date | null;
  dniDoKonca: number | null;
  lokale: {
    id: string;
    nazwa: string;
    slug: string;
    stolikow: number;
  }[];
  /** Ilu pracowników i czy ktokolwiek potwierdził adres — czy klient w ogóle wszedł. */
  pracownikow: number;
  ostatnieLogowanie: Date | null;
}

/**
 * Lista klientów platformy.
 *
 * To **jedyny ekran, który z definicji czyta w poprzek najemców** — i dlatego
 * jako jedyny sięga po połączenie katalogowe zamiast `withTenant` (docs/todo.md
 * §6a). Zapytanie jest wąskie i zamknięte: dane firmy, abonament i liczniki.
 * **Nie ma tu zamówień ani danych gości** — do żadnego z pytań, na które ta lista
 * odpowiada, nie są potrzebne, a jesteśmy wobec nich podmiotem przetwarzającym.
 */
@Injectable()
export class PlatformClientsService {
  private readonly directory = new PrismaClient({
    datasourceUrl: process.env.DIRECT_DATABASE_URL,
  });

  async list(): Promise<KlientPlatformy[]> {
    const organizacje = await this.directory.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: true,
        restaurants: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, slug: true, _count: { select: { tables: true } } },
        },
        staff: {
          select: { lastLoginAt: true },
        },
      },
    });

    return organizacje.map((organizacja) => {
      const koniec = organizacja.subscription?.currentPeriodEnd ?? null;
      const logowania = organizacja.staff
        .map((s) => s.lastLoginAt)
        .filter((data): data is Date => data !== null)
        .sort((a, b) => b.getTime() - a.getTime());

      return {
        organizationId: organizacja.id,
        nazwa: organizacja.name,
        nip: organizacja.nip,
        emailRozliczeniowy: organizacja.billingEmail,
        zalozone: organizacja.createdAt,
        regulaminZaakceptowany: organizacja.termsAcceptedAt,
        plan: organizacja.subscription?.plan ?? null,
        status: organizacja.subscription?.status ?? 'brak',
        demo: organizacja.subscription?.status === 'trialing',
        aktywny: subscriptionActive(organizacja.subscription),
        aktywnyDo: koniec,
        dniDoKonca: koniec ? Math.ceil((koniec.getTime() - Date.now()) / DZIEN) : null,
        lokale: organizacja.restaurants.map((lokal: (typeof organizacja.restaurants)[number]) => ({
          id: lokal.id,
          nazwa: lokal.name,
          slug: lokal.slug,
          stolikow: lokal._count.tables,
        })),
        pracownikow: organizacja.staff.length,
        ostatnieLogowanie: logowania[0] ?? null,
      };
    });
  }
}
