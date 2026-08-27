/**
 * Przypomnienia o kończącym się abonamencie.
 *
 * Dwa błędy są tu droższe niż brak funkcji. Wysłanie tej samej wiadomości drugi
 * raz podkopuje zaufanie do wszystkich naszych wiadomości. Wysłanie jej nie
 * w porę — „zostały trzy dni" tydzień po terminie — jest jeszcze gorsze, bo
 * mówi klientowi nieprawdę o stanie jego konta.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { BillingService } from '../src/billing/billing.service';
import { SubscriptionRemindersService } from '../src/billing/subscription-reminders.service';
import { PayuProvider } from '../src/billing/payu.provider';
import type { MailService } from '../src/mail/mail.service';
import { alertyDoTestow } from './alerty';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();

const wyslane: { to: string; subject: string; text: string }[] = [];
const mail = {
  send: async (w: { to: string; subject: string; text: string }) => {
    wyslane.push(w);
    return true;
  },
  skrzynkaKelbroo: 'kontakt@kelbroo.com',
  adresStrony: 'https://kelbroo.com',
} as unknown as MailService;

const DZIEN = 24 * 60 * 60 * 1000;

let przypomnienia: SubscriptionRemindersService;
let organizationId: string;

/** Abonament kończący się za `dni` (ujemne = po terminie). */
async function ustaw(dni: number, status: 'trialing' | 'active' = 'active') {
  await direct.subscriptionReminder.deleteMany({ where: { organizationId } });
  await direct.subscription.update({
    where: { organizationId },
    data: {
      status,
      plan: 'pro',
      // Południe, żeby zaokrąglanie do pełnych dni nie zależało od pory
      // uruchomienia testu.
      currentPeriodEnd: new Date(Date.now() + dni * DZIEN),
      tableLimit: 40,
      languageLimit: 6,
    },
  });
}

beforeAll(async () => {
  const { alerts } = alertyDoTestow();
  const billing = new BillingService(prisma, new PayuProvider(), mail, alerts);
  przypomnienia = new SubscriptionRemindersService(billing, mail, alerts);

  const organizacja = await direct.organization.create({
    data: {
      name: `Przypomnienia ${randomUUID().slice(0, 8)}`,
      billingEmail: 'wlasciciel@test.local',
      subscription: {
        create: { plan: 'pro', status: 'active', tableLimit: 40, languageLimit: 6 },
      },
    },
  });
  organizationId = organizacja.id;
});

beforeEach(() => {
  wyslane.length = 0;
});

afterAll(async () => {
  await direct.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

/** Wiadomości wysłane do tego klienta — w bazie są też inni najemcy. */
const doNas = () => wyslane.filter((w) => w.to === 'wlasciciel@test.local');

describe('kiedy przypominamy', () => {
  it('uprzedza na trzy dni przed końcem', async () => {
    await ustaw(3);

    await przypomnienia.przypomnij();

    expect(doNas()).toHaveLength(1);
    expect(doNas()[0].subject).toContain('kończy się');
  });

  it('milczy, gdy do końca jeszcze daleko', async () => {
    await ustaw(20);

    await przypomnienia.przypomnij();

    // Pasek widoczny przez trzy tygodnie przestaje być zauważany; wiadomość
    // wysłana z takim wyprzedzeniem też.
    expect(doNas()).toHaveLength(0);
  });

  it('zawiadamia o wstrzymaniu zamawiania w dniu wygaśnięcia', async () => {
    await ustaw(0);

    await przypomnienia.przypomnij();

    expect(doNas()).toHaveLength(1);
    expect(doNas()[0].subject).toContain('wygasł');
    expect(doNas()[0].text).toContain('Otwarte rachunki rozliczysz normalnie');
  });

  it('próbuje odzyskać klienta trzy dni po terminie', async () => {
    await ustaw(-3);

    await przypomnienia.przypomnij();

    expect(doNas()).toHaveLength(1);
    expect(doNas()[0].subject).toContain('wracamy');
  });

  it('nie zaczepia konta porzuconego dawno temu', async () => {
    // Pierwsze uruchomienie zadania nie może wysłać win-backu do wszystkich,
    // którzy odpadli kiedykolwiek — łącznie z kontami sprzed pół roku.
    await ustaw(-120);

    await przypomnienia.przypomnij();

    expect(doNas()).toHaveLength(0);
  });
});

describe('bez powtórek', () => {
  it('nie wysyła tego samego przypomnienia drugi raz', async () => {
    await ustaw(2);

    await przypomnienia.przypomnij();
    await przypomnienia.przypomnij();
    await przypomnienia.przypomnij();

    expect(doNas()).toHaveLength(1);
  });

  it('nie nadrabia zaległości serią wiadomości', async () => {
    // Zadanie milczało przez tydzień. „Zostały trzy dni" wysłane po terminie
    // mówiłoby klientowi nieprawdę — idzie tylko to najdalej posunięte.
    await ustaw(-4);

    await przypomnienia.przypomnij();

    expect(doNas()).toHaveLength(1);
    expect(doNas()[0].subject).toContain('wracamy');
  });

  it('po opłaceniu przypomina od nowa dla nowego okresu', async () => {
    await ustaw(1);
    await przypomnienia.przypomnij();
    expect(doNas()).toHaveLength(1);

    // Klient zapłacił, termin przeskoczył o miesiąc — i po miesiącu cała trójka
    // ma prawo pójść jeszcze raz. Dlatego klucz obejmuje datę końca okresu.
    wyslane.length = 0;
    await direct.subscription.update({
      where: { organizationId },
      data: { currentPeriodEnd: new Date(Date.now() + 2 * DZIEN) },
    });

    await przypomnienia.przypomnij();

    expect(doNas()).toHaveLength(1);
  });
});

describe('komu nie przypominamy', () => {
  it('pomija konto zablokowane przez nas', async () => {
    await ustaw(1);
    await direct.organization.update({
      where: { id: organizationId },
      data: { blockedAt: new Date(), blockedReason: 'test' },
    });
    try {
      await przypomnienia.przypomnij();

      // Blokadę zdejmuje człowiek z zaplecza, nie wpłata — zachęta do opłacenia
      // byłaby wprowadzaniem w błąd.
      expect(doNas()).toHaveLength(0);
    } finally {
      await direct.organization.update({
        where: { id: organizationId },
        data: { blockedAt: null, blockedReason: null },
      });
    }
  });

  it('pomija abonament bez daty końca', async () => {
    await direct.subscriptionReminder.deleteMany({ where: { organizationId } });
    await direct.subscription.update({
      where: { organizationId },
      data: { currentPeriodEnd: null, status: 'active' },
    });

    await przypomnienia.przypomnij();

    expect(doNas()).toHaveLength(0);
  });
});

describe('treść', () => {
  it('okresowi próbnemu mówi „okres próbny", a nie „abonament"', async () => {
    await ustaw(2, 'trialing');

    await przypomnienia.przypomnij();

    expect(doNas()[0].subject).toContain('Okres próbny');
    expect(doNas()[0].text).toContain('Wybierz plan');
  });

  it('obiecuje to samo, co regulamin: dane zostają', async () => {
    await ustaw(0);

    await przypomnienia.przypomnij();

    // Wygaśnięcie wstrzymuje zamawianie i nigdy nie kasuje danych (CLAUDE.md).
    // Klient przestraszony o menu i kody QR to klient, który dzwoni.
    expect(doNas()[0].text).toContain('nigdy nie kasuje danych');
  });

  it('prowadzi do ekranu abonamentu', async () => {
    await ustaw(1);

    await przypomnienia.przypomnij();

    expect(doNas()[0].text).toContain('/abonament');
  });
});
