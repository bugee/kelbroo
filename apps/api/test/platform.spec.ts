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

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });

const HASLO = 'bardzo-tajne-haslo-123';
const SEKRET = 'sekret-zaplecza-na-testy';

let platform: PlatformAuthService;
let clients: PlatformClientsService;
let adminId: string;
let email: string;
let organizationId: string;
/** Konto pracownika restauracji — do sprawdzenia granicy między systemami. */
let pracownikEmail: string;

beforeAll(async () => {
  process.env.ADMIN_JWT_SECRET = SEKRET;
  platform = new PlatformAuthService(new JwtService({}));
  clients = new PlatformClientsService();

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
  await direct.$disconnect();
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
