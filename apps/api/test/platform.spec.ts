/**
 * Zaplecze kelbroo (System 4).
 *
 * Reguła, która musi się tu trzymać ponad wszystkim: **konto platformy i konto
 * pracownika restauracji to dwa rozłączne światy**. Token jednego nie może
 * otwierać drugiego, i to nie dlatego, że ktoś pamiętał o sprawdzeniu roli,
 * tylko dlatego, że podpisy nie pasują.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../src/auth/auth.service';
import { PlatformAuthService } from '../src/platform/platform-auth.service';
import { PlatformClientsService } from '../src/platform/platform-clients.service';
import { PlatformClientService } from '../src/platform/platform-client.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { wymagajCzynnegoKonta } from '../src/common/subscription';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();

const HASLO = 'bardzo-tajne-haslo-123';
const SEKRET = 'sekret-zaplecza-na-testy';

let platform: PlatformAuthService;
let clients: PlatformClientsService;
let client: PlatformClientService;
let adminId: string;
let email: string;
let organizationId: string;
/** Konto pracownika restauracji — do sprawdzenia granicy między systemami. */
let pracownikEmail: string;

beforeAll(async () => {
  process.env.ADMIN_JWT_SECRET = SEKRET;
  platform = new PlatformAuthService(new JwtService({}));
  clients = new PlatformClientsService();
  client = new PlatformClientService(prisma);

  email = `admin-${randomUUID()}@kelbroo.test`;
  const admin = await direct.platformAdmin.create({
    data: { email, name: 'Testowy Administrator', passwordHash: await bcrypt.hash(HASLO, 10) },
  });
  adminId = admin.id;

  const organization = await direct.organization.create({
    data: { name: `Klient ${randomUUID()}`, billingEmail: 'klient@test.local', nip: '5222269366' },
  });
  organizationId = organization.id;
  await direct.subscription.create({
    data: {
      organizationId,
      plan: 'pro',
      status: 'trialing',
      currentPeriodEnd: new Date(Date.now() + 5 * 86_400_000),
      tableLimit: 40,
      languageLimit: 6,
    },
  });
  const lokal = await direct.restaurant.create({
    data: { organizationId, name: 'Lokal testowy', slug: `plat-${randomUUID()}`, currency: 'PLN' },
  });

  // Własne konto zamiast seeda: hasło z seeda bywa zmieniane przez inne testy,
  // a ten test nie jest o seedzie.
  pracownikEmail = `kelner-${randomUUID()}@test.local`;
  await direct.staffMember.create({
    data: {
      organizationId,
      restaurantId: lokal.id,
      email: pracownikEmail,
      name: 'Kelner Testowy',
      role: 'owner',
      passwordHash: await bcrypt.hash(HASLO, 10),
      emailVerifiedAt: new Date(),
    },
  });
});

afterAll(async () => {
  await direct.platformAdmin.delete({ where: { id: adminId } }).catch(() => undefined);
  await direct.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  delete process.env.ADMIN_JWT_SECRET;
  await direct.platformAuditLog.deleteMany({ where: { organizationId } });
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

describe('logowanie do zaplecza', () => {
  it('wpuszcza po poprawnym haśle i notuje logowanie', async () => {
    const wynik = await platform.login(email, HASLO);

    expect(wynik.admin.email).toBe(email);
    expect(wynik.accessToken).toBeTruthy();
    const admin = await direct.platformAdmin.findUniqueOrThrow({ where: { id: adminId } });
    expect(admin.lastLoginAt).not.toBeNull();
  });

  it('odmawia przy złym haśle i przy nieznanym koncie tak samo', async () => {
    await expect(platform.login(email, 'zupelnie-inne-haslo')).rejects.toThrow(
      'Nieprawidłowy e-mail lub hasło.',
    );
    await expect(platform.login('nikogo@kelbroo.test', HASLO)).rejects.toThrow(
      'Nieprawidłowy e-mail lub hasło.',
    );
  });

  it('nie wpuszcza konta wyłączonego', async () => {
    await direct.platformAdmin.update({ where: { id: adminId }, data: { isActive: false } });
    try {
      await expect(platform.login(email, HASLO)).rejects.toThrow(/Nieprawidłowy/);
    } finally {
      await direct.platformAdmin.update({ where: { id: adminId }, data: { isActive: true } });
    }
  });

  it('bez ADMIN_JWT_SECRET zaplecze jest zamknięte', async () => {
    delete process.env.ADMIN_JWT_SECRET;
    try {
      // Wdrożenie, w którym ktoś zapomniał zmiennej, nie wystawia zaplecza.
      await expect(platform.login(email, HASLO)).rejects.toThrow(/nie jest skonfigurowane/);
    } finally {
      process.env.ADMIN_JWT_SECRET = SEKRET;
    }
  });
});

describe('granica między systemami', () => {
  it('token pracownika restauracji nie otwiera zaplecza', async () => {
    const auth = new AuthService(new JwtService({}));
    const pracownik = await auth.login(pracownikEmail, HASLO);

    // Podpisy nie pasują — to nie jest kwestia sprawdzenia roli w kodzie.
    await expect(platform.verify(pracownik.accessToken)).rejects.toThrow(/Sesja wygasła/);
  });

  it('token zaplecza nie otwiera panelu restauracji', async () => {
    const { accessToken } = await platform.login(email, HASLO);
    const auth = new AuthService(new JwtService({}));

    await expect(auth.verifyAccessToken(accessToken)).rejects.toThrow();
  });

  it('token przestaje działać, gdy konto zostanie wyłączone', async () => {
    const { accessToken } = await platform.login(email, HASLO);
    await expect(platform.verify(accessToken)).resolves.toMatchObject({ adminId });

    await direct.platformAdmin.update({ where: { id: adminId }, data: { isActive: false } });
    try {
      // Ważny podpis nie wystarcza — konto sprawdzamy przy każdym żądaniu.
      await expect(platform.verify(accessToken)).rejects.toThrow(/Sesja wygasła/);
    } finally {
      await direct.platformAdmin.update({ where: { id: adminId }, data: { isActive: true } });
    }
  });
});

describe('lista klientów', () => {
  it('pokazuje abonament, okres próbny i lokale', async () => {
    const lista = await clients.list();
    const nasz = lista.find((klient) => klient.organizationId === organizationId);

    expect(nasz).toBeTruthy();
    expect(nasz!.plan).toBe('pro');
    expect(nasz!.demo).toBe(true);
    expect(nasz!.aktywny).toBe(true);
    expect(nasz!.dniDoKonca).toBeGreaterThan(0);
    expect(nasz!.nip).toBe('5222269366');
    expect(nasz!.lokale).toHaveLength(1);
  });

  it('oznacza wygasły abonament jako nieaktywny', async () => {
    await direct.subscription.update({
      where: { organizationId },
      data: { currentPeriodEnd: new Date(Date.now() - 86_400_000) },
    });

    const nasz = (await clients.list()).find((k) => k.organizationId === organizationId);
    expect(nasz!.aktywny).toBe(false);
    expect(nasz!.dniDoKonca).toBeLessThan(0);
  });

  it('nie wynosi z bazy zamówień ani danych gości', async () => {
    // Do żadnego pytania, na które ta lista odpowiada, nie są potrzebne —
    // a wobec nich jesteśmy podmiotem przetwarzającym, nie administratorem.
    const nasz = (await clients.list()).find((k) => k.organizationId === organizationId)!;
    const klucze = Object.keys(nasz).join(' ').toLowerCase();

    expect(klucze).not.toContain('order');
    expect(klucze).not.toContain('zamow');
    expect(klucze).not.toContain('guest');
    expect(klucze).not.toContain('gosc');
  });
});

/** Kontekst administratora do operacji. */
const jakoAdmin = () => ({ adminId, email, name: 'Testowy Administrator' });

describe('karta klienta', () => {
  it('pokazuje lokale, personel i zgody bez zamówień gości', async () => {
    const karta = await client.detail(organizationId);

    expect(karta.nazwa).toBeTruthy();
    expect(karta.lokale).toHaveLength(1);
    expect(karta.abonament.plan ?? karta.abonament.status).toBeTruthy();

    // Wsparcie potrzebuje kont personelu (np. „nie mogę się zalogować"),
    // ale nie ma powodu oglądać zamówień ani danych gości.
    const klucze = JSON.stringify(karta).toLowerCase();
    expect(klucze).not.toContain('orderitem');
    expect(klucze).not.toContain('tableparticipant');
  });

  it('odmawia dla nieistniejącego klienta', async () => {
    await expect(client.detail('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      /Nie ma takiego klienta/,
    );
  });
});

describe('operacje na abonamencie', () => {
  it('przedłuża od dziś, gdy termin już minął', async () => {
    await direct.subscription.update({
      where: { organizationId },
      data: { currentPeriodEnd: new Date(Date.now() - 30 * 86_400_000) },
    });

    const wynik = await client.extend(jakoAdmin(), organizationId, 14, 'przedłużenie handlowe');

    // Liczone od dziś, nie od minionego terminu — inaczej przedłużenie o 14 dni
    // komuś miesiąc po terminie nie dałoby ani jednego dnia działania.
    const dni = Math.round((wynik.currentPeriodEnd!.getTime() - Date.now()) / 86_400_000);
    expect(dni).toBe(14);
  });

  it('przedłuża od dotychczasowego terminu, gdy jeszcze trwa', async () => {
    const koniec = new Date(Date.now() + 10 * 86_400_000);
    await direct.subscription.update({
      where: { organizationId },
      data: { currentPeriodEnd: koniec },
    });

    const wynik = await client.extend(jakoAdmin(), organizationId, 5, 'bonus');
    const dni = Math.round((wynik.currentPeriodEnd!.getTime() - Date.now()) / 86_400_000);
    expect(dni).toBe(15);
  });

  it('wymaga powodu i sensownej liczby dni', async () => {
    await expect(client.extend(jakoAdmin(), organizationId, 14, '  ')).rejects.toThrow();
    await expect(client.extend(jakoAdmin(), organizationId, 0, 'powód')).rejects.toThrow(/1–365/);
    await expect(client.extend(jakoAdmin(), organizationId, 400, 'powód')).rejects.toThrow(/1–365/);
  });

  it('zmiana planu przestawia limity razem z nim', async () => {
    const wynik = await client.changePlan(jakoAdmin(), organizationId, 'starter', 'downgrade');

    // Zostawienie starych limitów dałoby lokal na Starterze z limitami Pro.
    expect(wynik.plan).toBe('starter');
    expect(wynik.tableLimit).toBe(12);
    expect(wynik.languageLimit).toBe(2);
  });

  it('zapisuje każdą operację w dzienniku, z powodem', async () => {
    await client.extend(jakoAdmin(), organizationId, 7, 'powód do dziennika');

    const wpis = await direct.platformAuditLog.findFirst({
      where: { organizationId, action: 'subscription.extended' },
      orderBy: { createdAt: 'desc' },
    });
    expect(wpis?.reason).toBe('powód do dziennika');
    expect(wpis?.adminId).toBe(adminId);
  });
});

describe('blokada administracyjna', () => {
  const czynne = () =>
    prisma.withTenant(organizationId, (tx) => wymagajCzynnegoKonta(tx, organizationId));

  it('wstrzymuje nowe zamówienia, a odblokowanie je przywraca', async () => {
    await direct.subscription.update({
      where: { organizationId },
      data: { status: 'active', currentPeriodEnd: null },
    });
    await expect(czynne()).resolves.toBeUndefined();

    await client.block(jakoAdmin(), organizationId, 'nieopłacone faktury');
    // Bez tego blokada byłaby wpisem w bazie bez żadnego skutku.
    await expect(czynne()).rejects.toThrow(/zablokowane: nieopłacone faktury/);

    await client.unblock(jakoAdmin(), organizationId, 'faktury opłacone');
    await expect(czynne()).resolves.toBeUndefined();
  });

  it('wymaga powodu przy nakładaniu', async () => {
    await expect(client.block(jakoAdmin(), organizationId, '   ')).rejects.toThrow(/powodu/);
  });

  it('nie kasuje żadnych danych klienta', async () => {
    const przed = await direct.restaurant.count({ where: { organizationId } });
    await client.block(jakoAdmin(), organizationId, 'test zasady');
    try {
      expect(await direct.restaurant.count({ where: { organizationId } })).toBe(przed);
      const org = await direct.organization.findUniqueOrThrow({ where: { id: organizationId } });
      expect(org.blockedReason).toBe('test zasady');
    } finally {
      await client.unblock(jakoAdmin(), organizationId, 'sprzątanie po teście');
    }
  });
});
