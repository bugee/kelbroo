/**
 * Powrót do wizyty bez ponownego skanowania.
 *
 * Cała wartość tej funkcji leży w tym, kogo **nie** wpuszczamy z powrotem.
 * Wejście z nieaktualnym tokenem nie kończy się błędem — serwer zakłada wtedy
 * nową tożsamość przy bieżącej wizycie stolika. Przy skanie to jest świadome
 * „dosiadam się tutaj, teraz"; przy cichym przekierowaniu z zakładki byłoby
 * dopisaniem kogoś do cudzego rachunku bez jego wiedzy.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { GuestResumeService } from '../src/guest/guest-resume.service';
import { GuestSessionService } from '../src/guest/guest-session.service';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();
const resume = new GuestResumeService(prisma);

let organizationId: string;
let restaurantId: string;
let tableId: string;
let qrToken: string;

/** Wizyta przy stoliku wraz z gościem trzymającym token w przeglądarce. */
async function wizytaZGosciem(opcje: { status?: 'open' | 'settled'; wygasla?: boolean } = {}) {
  const session = await direct.tableSession.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      businessDate: new Date(),
      sessionNumber: Math.floor(Math.random() * 100_000),
      openedBy: 'guest',
      currency: 'PLN',
      status: opcje.status ?? 'open',
    },
  });

  const participant = await direct.tableParticipant.create({
    data: {
      organizationId,
      tableSessionId: session.id,
      displayName: 'Wesoły Borsuk',
      symbol: 'star',
      color: 'teal',
      createdBy: 'guest',
    },
  });

  const token = randomUUID();
  await direct.guestSession.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      tableSessionId: session.id,
      participantId: participant.id,
      tokenHash: GuestSessionService.hash(token),
      locale: 'pl',
      expiresAt: new Date(Date.now() + (opcje.wygasla ? -3_600_000 : 6 * 3_600_000)),
    },
  });

  return { sessionId: session.id, token };
}

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Powrót ${randomUUID().slice(0, 8)}`, billingEmail: 'powrot@test.local' },
  });
  organizationId = organization.id;

  const restaurant = await direct.restaurant.create({
    data: { organizationId, name: 'Powrotna', slug: `powrot-${randomUUID()}`, currency: 'PLN' },
  });
  restaurantId = restaurant.id;

  qrToken = randomUUID().replace(/-/g, '');
  const table = await direct.table.create({
    data: { organizationId, restaurantId, label: 'Stolik 1', qrToken },
  });
  tableId = table.id;
});

beforeEach(async () => {
  await direct.tableSession.deleteMany({ where: { organizationId } });
});

afterAll(async () => {
  await direct.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

describe('wpuszczamy z powrotem', () => {
  it('gościa, którego wizyta wciąż trwa', async () => {
    const { token } = await wizytaZGosciem();

    expect(await resume.canResume(qrToken, token)).toBe(true);
  });
});

describe('nie wpuszczamy', () => {
  it('po rozliczeniu rachunku', async () => {
    // Wizyta skończona — wracać nie ma do czego, a przy stoliku może już
    // siedzieć kto inny.
    const { token } = await wizytaZGosciem({ status: 'settled' });

    expect(await resume.canResume(qrToken, token)).toBe(false);
  });

  it('po wygaśnięciu sesji gościa', async () => {
    const { token } = await wizytaZGosciem({ wygasla: true });

    expect(await resume.canResume(qrToken, token)).toBe(false);
  });

  it('do nowej wizyty przy tym samym stoliku', async () => {
    // **Najważniejszy test w tym pliku.** Gość wraca po godzinach, a stolik
    // zdążył zostać rozliczony i zająć przez obcych. Sam token jest wciąż jego,
    // ale wizyta już nie — ciche przekierowanie dopisałoby go do ich rachunku.
    const stary = await wizytaZGosciem();
    await direct.tableSession.update({
      where: { id: stary.sessionId },
      data: { status: 'settled' },
    });
    await wizytaZGosciem();

    expect(await resume.canResume(qrToken, stary.token)).toBe(false);
  });

  it('z cudzym tokenem', async () => {
    await wizytaZGosciem();

    expect(await resume.canResume(qrToken, randomUUID())).toBe(false);
  });

  it('pod nieznanym kodem QR', async () => {
    const { token } = await wizytaZGosciem();

    expect(await resume.canResume('kod-ktorego-nie-ma', token)).toBe(false);
  });

  it('bez tokenu i bez kodu', async () => {
    // Okno prywatne albo wyczyszczone dane: pytanie przychodzi puste
    // i ma dostać spokojne „nie", a nie wyjątek.
    expect(await resume.canResume(qrToken, '')).toBe(false);
    expect(await resume.canResume('', 'cokolwiek')).toBe(false);
  });
});
