/**
 * Zarządzanie kontami pracowników.
 *
 * Ekran zakładania kont jest jednocześnie najkrótszą drogą do przejęcia
 * restauracji, więc testy pilnują przede wszystkim tego, czego zrobić NIE wolno:
 * awansu do właściciela, sięgnięcia do konta wyżej w hierarchii i odebrania
 * lokalowi ostatniego właściciela.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../src/prisma/prisma.service';
import { StaffAdminService } from '../src/management/staff.admin.service';
import { AuthService } from '../src/auth/auth.service';
import type { StaffContext } from '../src/auth/auth.types';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();
const staffAdmin = new StaffAdminService(prisma);
const auth = new AuthService(new JwtService({}));

let organizationId: string;
let restaurantId: string;
let owner: StaffContext;
let manager: StaffContext;

const email = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}@staff.test`;

async function seedMember(role: 'owner' | 'manager' | 'waiter' | 'kitchen', name: string) {
  return direct.staffMember.create({
    data: {
      organizationId,
      restaurantId,
      email: email(role),
      name,
      role,
      passwordHash: await bcrypt.hash('poczatkowe123', 10),
    },
  });
}

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Staff ${randomUUID()}`, billingEmail: 'staff@test.local' },
  });
  organizationId = organization.id;

  const restaurant = await direct.restaurant.create({
    data: { organizationId, name: 'Kadrowa', slug: `staff-${randomUUID()}` },
  });
  restaurantId = restaurant.id;

  const ownerRow = await seedMember('owner', 'Właściciel');
  const managerRow = await seedMember('manager', 'Manager');

  owner = {
    staffId: ownerRow.id,
    organizationId,
    restaurantId,
    role: 'owner',
    name: 'Właściciel',
  };
  manager = {
    staffId: managerRow.id,
    organizationId,
    restaurantId,
    role: 'manager',
    name: 'Manager',
  };
});

afterAll(async () => {
  if (organizationId) await direct.organization.delete({ where: { id: organizationId } });
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

describe('zakładanie kont', () => {
  it('nadaje hasło tymczasowe, które trzeba zmienić przy pierwszym logowaniu', async () => {
    const adres = email('kelner');
    const created = await staffAdmin.create(manager, {
      email: adres,
      name: 'Kelner Nowy',
      role: 'waiter',
      password: 'startowe123',
    });

    expect(created.mustChangePassword).toBe(true);
    await expect(auth.login(adres, 'startowe123')).resolves.toMatchObject({
      staff: { mustChangePassword: true },
    });
  });

  it('zapisuje adres małymi literami i bez spacji', async () => {
    const adres = email('WIELKIE');
    const created = await staffAdmin.create(owner, {
      email: `  ${adres.toUpperCase()}  `,
      name: 'Kuchnia',
      role: 'kitchen',
      password: 'startowe123',
    });

    // Logowanie szuka po lower(trim()), ale porównuje dosłownie — adres zapisany
    // wielkimi literami byłby kontem nie do zalogowania.
    expect(created.email).toBe(adres.toLowerCase());
    await expect(auth.login(adres.toUpperCase(), 'startowe123')).resolves.toMatchObject({
      staff: { staffId: created.id },
    });
  });

  it('odrzuca drugi adres taki sam w tym samym lokalu', async () => {
    const adres = email('duplikat');
    await staffAdmin.create(owner, {
      email: adres,
      name: 'Pierwszy',
      role: 'waiter',
      password: 'startowe123',
    });

    await expect(
      staffAdmin.create(owner, {
        email: adres,
        name: 'Drugi',
        role: 'waiter',
        password: 'startowe123',
      }),
    ).rejects.toThrow('Konto z tym adresem e-mail już istnieje w tym lokalu.');
  });

  it('manager nie może założyć konta właściciela', async () => {
    await expect(
      staffAdmin.create(manager, {
        email: email('awans'),
        name: 'Podstawiony',
        role: 'owner',
        password: 'startowe123',
      }),
    ).rejects.toThrow('Twoja rola nie pozwala nadać tej roli.');
  });
});

describe('granice uprawnień', () => {
  it('manager nie sięgnie do konta właściciela', async () => {
    const drugiWlasciciel = await seedMember('owner', 'Drugi właściciel');

    await expect(staffAdmin.setActive(manager, drugiWlasciciel.id, false)).rejects.toThrow(
      'Twoja rola nie pozwala zmieniać tego konta.',
    );
    await expect(
      staffAdmin.resetPassword(manager, drugiWlasciciel.id, 'przejete123'),
    ).rejects.toThrow('Twoja rola nie pozwala zmieniać tego konta.');
  });

  it('manager nie awansuje kelnera na właściciela', async () => {
    const kelner = await seedMember('waiter', 'Kelner');

    await expect(staffAdmin.update(manager, kelner.id, { role: 'owner' })).rejects.toThrow(
      'Twoja rola nie pozwala nadać tej roli.',
    );
  });

  it('własnego konta nie da się zmienić z listy pracowników', async () => {
    await expect(staffAdmin.setActive(owner, owner.staffId, false)).rejects.toThrow(
      'Własnego konta nie zmienisz z tej listy.',
    );
  });

  it('konto z innego lokalu jest niewidoczne', async () => {
    const obcaOrganizacja = await direct.organization.create({
      data: { name: `Obca ${randomUUID()}`, billingEmail: 'obca@test.local' },
    });
    const obcaRestauracja = await direct.restaurant.create({
      data: {
        organizationId: obcaOrganizacja.id,
        name: 'Obca',
        slug: `obca-${randomUUID()}`,
      },
    });
    const obcy = await direct.staffMember.create({
      data: {
        organizationId: obcaOrganizacja.id,
        restaurantId: obcaRestauracja.id,
        email: email('obcy'),
        name: 'Obcy',
        role: 'waiter',
        passwordHash: 'x',
      },
    });

    await expect(staffAdmin.setActive(owner, obcy.id, false)).rejects.toThrow(
      'Konto nie istnieje.',
    );

    await direct.organization.delete({ where: { id: obcaOrganizacja.id } });
  });
});

describe('lokal nie może zostać bez właściciela', () => {
  it('właściciel nie zdegraduje ani nie wyłączy sam siebie', async () => {
    // To jest właściwa bariera. Skoro własnego konta nie da się ruszyć z listy,
    // a rolę właściciela może zmieniać wyłącznie inny właściciel, w lokalu
    // zawsze zostaje co najmniej jeden aktywny — ten, który klika.
    await expect(staffAdmin.update(owner, owner.staffId, { role: 'waiter' })).rejects.toThrow(
      'Własnego konta nie zmienisz z tej listy.',
    );
    await expect(staffAdmin.setActive(owner, owner.staffId, false)).rejects.toThrow(
      'Własnego konta nie zmienisz z tej listy.',
    );
  });

  it('po zdegradowaniu drugiego właściciela lokal wciąż ma aktywnego właściciela', async () => {
    const drugi = await seedMember('owner', 'Drugi właściciel');
    const kontekstDrugiego: StaffContext = {
      staffId: drugi.id,
      organizationId,
      restaurantId,
      role: 'owner',
      name: 'Drugi właściciel',
    };

    await expect(
      staffAdmin.update(kontekstDrugiego, owner.staffId, { role: 'manager' }),
    ).resolves.toMatchObject({ role: 'manager' });

    const aktywniWlasciciele = await direct.staffMember.count({
      where: { restaurantId, role: 'owner', isActive: true },
    });
    expect(aktywniWlasciciele).toBeGreaterThan(0);

    // Przywracamy stan dla kolejnych testów.
    await direct.staffMember.update({ where: { id: owner.staffId }, data: { role: 'owner' } });
    await direct.staffMember.delete({ where: { id: drugi.id } });
  });
});

describe('reset hasła przez managera', () => {
  it('ustawia nowe hasło i wymusza jego zmianę', async () => {
    const adres = email('reset');
    const created = await staffAdmin.create(manager, {
      email: adres,
      name: 'Do resetu',
      role: 'kitchen',
      password: 'pierwsze123',
    });
    await direct.staffMember.update({
      where: { id: created.id },
      data: { mustChangePassword: false },
    });

    const po = await staffAdmin.resetPassword(manager, created.id, 'nadane456');

    expect(po.mustChangePassword).toBe(true);
    await expect(auth.login(adres, 'nadane456')).resolves.toMatchObject({
      staff: { staffId: created.id },
    });
    await expect(auth.login(adres, 'pierwsze123')).rejects.toThrow(
      'Nieprawidłowy e-mail lub hasło.',
    );
  });
});

describe('lista pracowników', () => {
  it('oznacza konto własne i te, których nie wolno ruszać', async () => {
    const lista = await staffAdmin.list(manager);
    const wlasne = lista.find((member) => member.id === manager.staffId);
    const wlasciciele = lista.filter((member) => member.role === 'owner');

    expect(wlasne?.isSelf).toBe(true);
    expect(wlasne?.canManage).toBe(false);
    expect(wlasciciele.length).toBeGreaterThan(0);
    expect(wlasciciele.every((member) => member.canManage)).toBe(false);
  });
});

/**
 * Limit kont personelu z planu.
 *
 * Cennik obiecywał go od początku (1 / 3 / bez limitu), a nic go nie pilnowało.
 * Ta grupa testów jest jedynym miejscem, w którym widać, że obietnica z cennika
 * ma pokrycie.
 */
describe('limit kont z planu', () => {
  /** Ustawia abonament z zadanym limitem. Brak abonamentu = brak limitu. */
  async function planZLimitem(staffLimit: number) {
    await direct.subscription.upsert({
      where: { organizationId },
      update: { staffLimit, plan: 'starter', status: 'active' },
      create: {
        organizationId,
        plan: 'starter',
        status: 'active',
        tableLimit: 12,
        languageLimit: 2,
        staffLimit,
      },
    });
  }

  const nowyKelner = () => ({
    email: email('limit'),
    name: 'Kelner Testowy',
    role: 'waiter' as const,
    password: 'poczatkowe123',
  });

  it('odmawia założenia konta ponad limit i mówi, co zrobić', async () => {
    const czynne = await direct.staffMember.count({ where: { organizationId, isActive: true } });
    await planZLimitem(czynne);

    await expect(staffAdmin.create(owner, nowyKelner())).rejects.toThrow(/obejmuje .* personelu/);
  });

  it('wpuszcza, gdy w planie jest jeszcze miejsce', async () => {
    const czynne = await direct.staffMember.count({ where: { organizationId, isActive: true } });
    await planZLimitem(czynne + 1);

    const utworzony = await staffAdmin.create(owner, nowyKelner());
    expect(utworzony.id).toBeTruthy();

    await direct.staffMember.delete({ where: { id: utworzony.id } });
  });

  it('nie liczy kont wyłączonych', async () => {
    // Wyłączone konto zostaje w bazie, bo zamówienia są nim podpisane. Doliczanie
    // go do limitu karałoby lokal za rotację pracowników.
    const wylaczony = await seedMember('waiter', 'Były pracownik');
    await direct.staffMember.update({ where: { id: wylaczony.id }, data: { isActive: false } });

    const czynne = await direct.staffMember.count({ where: { organizationId, isActive: true } });
    await planZLimitem(czynne + 1);

    const utworzony = await staffAdmin.create(owner, nowyKelner());
    expect(utworzony.id).toBeTruthy();

    await direct.staffMember.deleteMany({ where: { id: { in: [utworzony.id, wylaczony.id] } } });
  });

  it('bez abonamentu nie ogranicza niczego', async () => {
    // Konta zakładane przez nas przed wprowadzeniem abonamentu nie mogą przestać
    // działać dlatego, że nikt nie przypisał im planu.
    await direct.subscription.deleteMany({ where: { organizationId } });

    const utworzony = await staffAdmin.create(owner, nowyKelner());
    expect(utworzony.id).toBeTruthy();

    await direct.staffMember.delete({ where: { id: utworzony.id } });
  });
});
