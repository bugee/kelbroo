/**
 * Zdjęcia dań.
 *
 * Trzy rzeczy trzeba tu pilnować. Funkcja jest płatna, więc bramka planu musi
 * działać po stronie serwera, a nie tylko chować przycisk. Zdjęcie jest jedno
 * na pozycję, więc wgranie nowego ma **skasować stary plik** — inaczej dysk
 * rośnie po każdej poprawce karty. I plik nigdy nie może zostać bez wiersza
 * w bazie, bo takiego śmiecia nikt już nie znajdzie.
 */
import { randomUUID } from 'node:crypto';
import { chmod, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { MenuImageService } from '../src/media/menu-image.service';
import { LocalDiskImageStorage, rozpoznajTyp } from '../src/media/menu-image.storage';
import type { StaffContext } from '../src/auth/auth.types';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();

let katalog: string;
let images: MenuImageService;
let organizationId: string;
let restaurantId: string;
let categoryId: string;
let staff: StaffContext;

/** Najmniejszy poprawny JPEG: sama sygnatura wystarcza do rozpoznania typu. */
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
const png = () =>
  Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(64, 3)]);

async function danie() {
  return direct.menuItem.create({
    data: {
      organizationId,
      restaurantId,
      categoryId,
      priceCents: 4900,
      currency: 'PLN',
      vatRate: '0.0800',
    },
  });
}

async function ustawFunkcje(enabled: boolean) {
  await direct.subscription.upsert({
    where: { organizationId },
    update: { menuPhotosEnabled: enabled },
    create: {
      organizationId,
      plan: 'pro',
      status: 'active',
      tableLimit: 40,
      languageLimit: 6,
      staffLimit: 9999,
      menuPhotosEnabled: enabled,
    },
  });
}

const plikow = () => readdir(katalog).then((lista) => lista.length);

beforeAll(async () => {
  katalog = await mkdtemp(path.join(tmpdir(), 'kelbroo-media-'));
  process.env.MEDIA_ROOT = katalog;
  images = new MenuImageService(prisma, new LocalDiskImageStorage());

  const organization = await direct.organization.create({
    data: { name: `Zdjęcia ${randomUUID().slice(0, 8)}`, billingEmail: 'foto@test.local' },
  });
  organizationId = organization.id;

  const restaurant = await direct.restaurant.create({
    data: { organizationId, name: 'Fotogeniczna', slug: `foto-${randomUUID()}`, currency: 'PLN' },
  });
  restaurantId = restaurant.id;

  const category = await direct.menuCategory.create({
    data: { organizationId, restaurantId },
  });
  categoryId = category.id;

  const member = await direct.staffMember.create({
    data: {
      organizationId,
      restaurantId,
      email: `foto-${randomUUID().slice(0, 8)}@test.local`,
      name: 'Właściciel',
      role: 'owner',
      passwordHash: 'x',
    },
  });
  staff = {
    staffId: member.id,
    organizationId,
    restaurantId,
    role: 'owner',
    name: 'Właściciel',
  };
});

afterAll(async () => {
  await direct.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  delete process.env.MEDIA_ROOT;
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

describe('bramka planu', () => {
  it('odmawia wgrania, gdy plan nie obejmuje zdjęć', async () => {
    await ustawFunkcje(false);
    const item = await danie();

    await expect(images.upload(staff, item.id, jpeg())).rejects.toThrow(/plan(ie)? Pro/i);
  });

  it('nie zostawia pliku po odmowie', async () => {
    await ustawFunkcje(false);
    const item = await danie();
    const przed = await plikow();

    await images.upload(staff, item.id, jpeg()).catch(() => undefined);

    // Bramka działa **przed** zapisem — inaczej dysk zbierałby zdjęcia lokali,
    // które nie mają do nich prawa.
    expect(await plikow()).toBe(przed);
  });

  it('wpuszcza po włączeniu funkcji z zaplecza', async () => {
    // Zaplecze może włączyć zdjęcia pojedynczemu klientowi bez zmiany planu.
    await ustawFunkcje(true);
    const item = await danie();

    expect((await images.upload(staff, item.id, jpeg())).imageUrl).toMatch(/\.jpg$/);
  });
});

describe('katalog bez prawa zapisu', () => {
  /**
   * Tak wyglądał błąd na produkcji: wolumen Dockera powstał jako `root`, a API
   * chodzi jako zwykły użytkownik. Odczyt działał, więc **zdjęcia wgrane
   * wcześniej się wyświetlały** — psuło się dopiero wgrywanie, gołym 500 bez
   * słowa wyjaśnienia. Test pilnuje, żeby komunikat mówił, co jest nie tak.
   */
  it('mówi, o co chodzi, zamiast wywracać się bez słowa', async () => {
    await ustawFunkcje(true);
    const item = await danie();
    const zamkniety = await mkdtemp(path.join(tmpdir(), 'kelbroo-media-ro-'));
    const poprzedni = process.env.MEDIA_ROOT;

    await chmod(zamkniety, 0o500);
    process.env.MEDIA_ROOT = zamkniety;
    try {
      await expect(images.upload(staff, item.id, jpeg())).rejects.toThrow(/katalog/i);
    } finally {
      process.env.MEDIA_ROOT = poprzedni;
      await chmod(zamkniety, 0o700);
    }
  });
});

describe('jedno zdjęcie na pozycję', () => {
  it('wgranie nowego kasuje stary plik', async () => {
    await ustawFunkcje(true);
    const item = await danie();

    const pierwsze = await images.upload(staff, item.id, jpeg());
    const drugie = await images.upload(staff, item.id, png());

    expect(drugie.imageUrl).not.toBe(pierwsze.imageUrl);
    const pliki = await readdir(katalog);
    // Bez tego karta poprawiana co tydzień zostawiałaby na dysku wszystkie
    // poprzednie wersje każdego dania.
    expect(pliki).not.toContain(pierwsze.imageUrl);
    expect(pliki).toContain(drugie.imageUrl);
  });

  it('usunięcie zdejmuje i wiersz, i plik', async () => {
    await ustawFunkcje(true);
    const item = await danie();
    const wgrane = await images.upload(staff, item.id, jpeg());

    expect(await images.remove(staff, item.id)).toEqual({ removed: true });

    expect(await readdir(katalog)).not.toContain(wgrane.imageUrl);
    const zapisane = await direct.menuItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(zapisane.imageUrl).toBeNull();
  });

  it('usunięcie nieistniejącego zdjęcia niczego nie psuje', async () => {
    await ustawFunkcje(true);
    const item = await danie();

    expect(await images.remove(staff, item.id)).toEqual({ removed: false });
  });
});

describe('cudza pozycja', () => {
  it('nie da się opisać zdjęciem dania spoza swojego lokalu', async () => {
    await ustawFunkcje(true);
    const przed = await plikow();

    await expect(images.upload(staff, randomUUID(), jpeg())).rejects.toThrow(/takiej pozycji/);

    // Plik zapisujemy przed zajrzeniem do bazy, więc po nieudanym zapisie
    // trzeba go posprzątać — inaczej zostaje sierota bez żadnego wiersza.
    expect(await plikow()).toBe(przed);
  });
});

describe('rozpoznawanie typu', () => {
  it('czyta typ z zawartości, nie z nagłówka', () => {
    expect(rozpoznajTyp(jpeg()).ext).toBe('jpg');
    expect(rozpoznajTyp(png()).ext).toBe('png');
  });

  it('odrzuca plik, który nie jest zdjęciem', () => {
    // Nagłówek `content-type` pisze przeglądarka, a plik trafia potem
    // na telefony gości.
    expect(() => rozpoznajTyp(Buffer.from('<?php echo 1; ?>'))).toThrow(/nie jest zdjęcie/i);
  });
});
