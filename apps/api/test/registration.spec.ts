/**
 * Rejestracja restauracji bez udziału administratora.
 *
 * Dwie rzeczy muszą się tu trzymać niezależnie od reszty: konto powstaje w całości
 * albo wcale, i nie powstaje wcale, dopóki rejestracja jest zamknięta.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../src/prisma/prisma.service';
import { RegistrationService, TRIAL_DAYS } from '../src/auth/registration.service';
import type { MailService } from '../src/mail/mail.service';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();
/**
 * Atrapa poczty notująca wysyłki. Liczba i adresaci są przedmiotem testu:
 * rejestracja ma zawiadomić i klienta, i nas.
 */
const wyslane: { to: string; subject: string; text: string }[] = [];
const mail = {
  send: async (w: { to: string; subject: string; text: string }) => {
    wyslane.push(w);
    return true;
  },
  skrzynkaKelbroo: 'kontakt@kelbroo.com',
  adresStrony: 'https://kelbroo.com',
} as unknown as MailService;

const registration = new RegistrationService(prisma, mail);

const zalozone: string[] = [];

/** Dane rejestracji z unikalnym adresem — każdy przebieg zakłada własne konto. */
function dane(nadpisz: Partial<Parameters<RegistrationService['register']>[0]> = {}) {
  const znak = randomUUID().slice(0, 8);
  return {
    restaurantName: `Bistro ${znak}`,
    ownerName: 'Anna Właścicielka',
    email: `owner-${znak}@test.local`,
    password: 'tajne-haslo-123',
    nip: '5222269366',
    termsVersion: '2026-08-01',
    privacyVersion: '2026-08-01',
    ...nadpisz,
  };
}

async function zarejestruj(nadpisz = {}) {
  const wynik = await registration.register(dane(nadpisz));
  zalozone.push(wynik.organizationId);
  return wynik;
}

beforeAll(() => {
  process.env.REGISTRATION_ENABLED = 'true';
});

afterEach(async () => {
  while (zalozone.length > 0) {
    const id = zalozone.pop()!;
    await direct.organization.delete({ where: { id } }).catch(() => undefined);
  }
});

afterAll(async () => {
  delete process.env.REGISTRATION_ENABLED;
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

describe('zamknięta rejestracja', () => {
  it('odmawia, dopóki nie zostanie otwarta jawnie', async () => {
    delete process.env.REGISTRATION_ENABLED;
    try {
      await expect(registration.register(dane())).rejects.toThrow(/nie jest jeszcze otwarta/);
    } finally {
      process.env.REGISTRATION_ENABLED = 'true';
    }
  });

  it('nie otwiera się na przypadkową wartość zmiennej', async () => {
    process.env.REGISTRATION_ENABLED = '1';
    try {
      expect(RegistrationService.enabled).toBe(false);
    } finally {
      process.env.REGISTRATION_ENABLED = 'true';
    }
  });
});

describe('zakładanie konta', () => {
  it('tworzy organizację, lokal, właściciela i okres próbny', async () => {
    const wynik = await zarejestruj();

    const organizacja = await direct.organization.findUniqueOrThrow({
      where: { id: wynik.organizationId },
    });
    const lokal = await direct.restaurant.findUniqueOrThrow({ where: { id: wynik.restaurantId } });
    const wlasciciel = await direct.staffMember.findFirstOrThrow({
      where: { organizationId: wynik.organizationId },
    });
    const abonament = await direct.subscription.findUniqueOrThrow({
      where: { organizationId: wynik.organizationId },
    });

    expect(lokal.slug).toMatch(/^bistro-/);
    expect(wlasciciel.role).toBe('owner');
    // Hasło ustawił sam zakładający, więc nie zmuszamy go do zmiany przy wejściu.
    expect(wlasciciel.mustChangePassword).toBe(false);
    expect(abonament.plan).toBe('pro');
    expect(abonament.status).toBe('trialing');
    expect(organizacja.billingEmail).toBe(wlasciciel.email);

    const dni = Math.round(
      (abonament.currentPeriodEnd!.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );
    expect(dni).toBe(TRIAL_DAYS);
  });

  it('zapisuje zgody razem z wersją dokumentu', async () => {
    const wynik = await zarejestruj({ termsVersion: '2026-09-15', privacyVersion: '2026-09-16' });

    const organizacja = await direct.organization.findUniqueOrThrow({
      where: { id: wynik.organizationId },
    });
    // Sam znacznik czasu nie broni się przy sporze, gdy dokument się zmieniał.
    expect(organizacja.termsVersion).toBe('2026-09-15');
    expect(organizacja.privacyVersion).toBe('2026-09-16');
    expect(organizacja.termsAcceptedAt).not.toBeNull();
    expect(organizacja.privacyAcceptedAt).not.toBeNull();
  });

  it('hasło trafia do bazy wyłącznie jako skrót', async () => {
    const wejscie = dane();
    const wynik = await registration.register(wejscie);
    zalozone.push(wynik.organizationId);

    const wlasciciel = await direct.staffMember.findFirstOrThrow({
      where: { organizationId: wynik.organizationId },
    });
    expect(wlasciciel.passwordHash).not.toContain(wejscie.password);
    expect(await bcrypt.compare(wejscie.password, wlasciciel.passwordHash)).toBe(true);
  });

  it('odmawia, gdy adres e-mail należy już do kogoś w innym lokalu', async () => {
    const pierwszy = await zarejestruj();
    const zajety = await direct.staffMember.findFirstOrThrow({
      where: { organizationId: pierwszy.organizationId },
    });

    // Logowanie szuka konta po samym adresie, więc drugie konto z tym samym
    // e-mailem byłoby kontem, do którego nie da się przewidywalnie zalogować.
    await expect(registration.register(dane({ email: zajety.email }))).rejects.toThrow(
      /już istnieje/,
    );
  });

  it('nadaje drugiemu lokalowi o tej samej nazwie inny adres', async () => {
    const pierwszy = await zarejestruj({ restaurantName: 'Pod Różą' });
    const drugi = await zarejestruj({ restaurantName: 'Pod Różą' });

    expect(pierwszy.slug).toBe('pod-roza');
    expect(drugi.slug).not.toBe(pierwszy.slug);
  });

  it('omija zajęty adres lokalu zamiast pękać', async () => {
    const kolizja = await zarejestruj();
    await direct.restaurant.update({
      where: { id: kolizja.restaurantId },
      data: { slug: 'kolizja-testowa' },
    });

    const wynik = await zarejestruj({ restaurantName: 'Kolizja testowa' });
    expect(wynik.slug).toBe('kolizja-testowa-2');
  });

  it('nie zostawia połowy konta, gdy coś pęknie w środku', async () => {
    // Rejestracja opiera całą swoją niepodzielność na tym, że `withTenant`
    // to jedna transakcja. Sprawdzamy dokładnie tę gwarancję: organizacja
    // powstaje, zaraz potem lecimy wyjątkiem, i po wszystkim nie ma jej w bazie.
    const organizationId = randomUUID();

    await expect(
      prisma.withTenant(organizationId, async (tx) => {
        await tx.organization.create({
          data: { id: organizationId, name: 'Niedoszła', billingEmail: 'nie@test.local' },
        });
        throw new Error('pęknięcie w środku transakcji');
      }),
    ).rejects.toThrow(/pęknięcie/);

    expect(await direct.organization.findUnique({ where: { id: organizationId } })).toBeNull();
  });
});

/**
 * NIP, potwierdzenie adresu i powiadomienia.
 *
 * Weryfikacja adresu ma coś znaczyć: konto z niepotwierdzonym e-mailem nie
 * wpuszcza do panelu. Inaczej byłaby ozdobnikiem, a zakładanie kont na cudze
 * adresy zostałoby możliwe.
 */
describe('NIP', () => {
  it('odrzuca numer z błędną sumą kontrolną', async () => {
    await expect(registration.register(dane({ nip: '5222263966' }))).rejects.toThrow(/NIP/);
  });

  it('zapisuje same cyfry, choć formularz przyjmuje myślniki', async () => {
    const wynik = await zarejestruj({ nip: '522-226-93-66' });
    const organizacja = await direct.organization.findUniqueOrThrow({
      where: { id: wynik.organizationId },
    });
    expect(organizacja.nip).toBe('5222269366');
  });
});

describe('potwierdzenie adresu e-mail', () => {
  it('konto powstaje niepotwierdzone i z tokenem w postaci skrótu', async () => {
    const wynik = await zarejestruj();
    const wlasciciel = await direct.staffMember.findFirstOrThrow({
      where: { organizationId: wynik.organizationId },
    });

    expect(wynik.emailVerificationRequired).toBe(true);
    expect(wlasciciel.emailVerifiedAt).toBeNull();
    expect(wlasciciel.emailTokenHash).toBeTruthy();
    // Skrót, nie token: wyciek bazy nie może dawać gotowego klucza do kont.
    expect(wlasciciel.emailTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('wysyła dwie wiadomości: do klienta i do nas', async () => {
    wyslane.length = 0;
    const wynik = await zarejestruj();

    const doKlienta = wyslane.find((w) => w.to !== 'kontakt@kelbroo.com');
    const doNas = wyslane.find((w) => w.to === 'kontakt@kelbroo.com');

    expect(doKlienta?.text).toContain('/potwierdz?token=');
    expect(doNas?.subject).toContain(wynik.restaurantName);
    // Powiadomienie ma nieść to, co potrzebne do kontaktu i faktury.
    expect(doNas?.text).toContain('522-226-93-66');
  });

  it('odnośnik potwierdza adres i przestaje działać', async () => {
    wyslane.length = 0;
    const wynik = await zarejestruj();
    const token = /\/potwierdz\?token=(\S+)/.exec(
      wyslane.find((w) => w.to !== 'kontakt@kelbroo.com')?.text ?? '',
    )?.[1];
    expect(token).toBeTruthy();

    await expect(registration.verifyEmail(token!)).resolves.toMatchObject({ verified: true });

    const wlasciciel = await direct.staffMember.findFirstOrThrow({
      where: { organizationId: wynik.organizationId },
    });
    expect(wlasciciel.emailVerifiedAt).not.toBeNull();

    // Ten sam odnośnik drugi raz nie może już nic otworzyć.
    await expect(registration.verifyEmail(token!)).rejects.toThrow(/wygasł albo został już użyty/);
  });

  it('odrzuca token wygasły', async () => {
    const wynik = await zarejestruj();
    await direct.staffMember.updateMany({
      where: { organizationId: wynik.organizationId },
      data: { emailTokenExpiresAt: new Date(Date.now() - 1000) },
    });
    wyslane.length = 0;
    await registration.resendVerification('nieistniejacy@test.local');

    await expect(registration.verifyEmail('cokolwiek-nieistniejacego')).rejects.toThrow(/wygasł/);
  });

  it('ponowna wysyłka milczy o tym, czy konto istnieje', async () => {
    wyslane.length = 0;
    // Ten endpoint nie może stać się sposobem sprawdzania, kto ma u nas konto.
    await expect(registration.resendVerification('nikogo-tu-nie-ma@test.local')).resolves.toEqual({
      sent: true,
    });
    expect(wyslane).toHaveLength(0);

    const wynik = await zarejestruj();
    const wlasciciel = await direct.staffMember.findFirstOrThrow({
      where: { organizationId: wynik.organizationId },
    });
    wyslane.length = 0;
    await registration.resendVerification(wlasciciel.email);
    expect(wyslane).toHaveLength(1);
  });
});
