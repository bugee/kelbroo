/**
 * Podział rachunku wizyty.
 *
 * Niezmiennik jest tu ważniejszy niż jakakolwiek wygoda: suma grup musi równać
 * się kwocie rachunku co do grosza. Rachunek, który po podziale nie zgadza się
 * o grosz, to spór przy stoliku i różnica w kasie na koniec zmiany.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { SplitService } from '../src/staff/split.service';
import { planSplit } from '../src/staff/split-plan';
import type { StaffContext } from '../src/auth/auth.types';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();
const split = new SplitService(prisma);

let organizationId: string;
let restaurantId: string;
let tableId: string;
let waiter: StaffContext;

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Split ${randomUUID()}`, billingEmail: 'split@test.local' },
  });
  organizationId = organization.id;

  const restaurant = await direct.restaurant.create({
    data: { organizationId, name: 'Dzielona', slug: `split-${randomUUID()}`, currency: 'PLN' },
  });
  restaurantId = restaurant.id;

  const table = await direct.table.create({
    data: {
      organizationId,
      restaurantId,
      label: 'Stolik 1',
      qrToken: randomBytes(16).toString('base64url'),
    },
  });
  tableId = table.id;

  const member = await direct.staffMember.create({
    data: {
      organizationId,
      restaurantId,
      email: `split-${randomUUID()}@test.local`,
      name: 'Kelner',
      role: 'waiter',
      passwordHash: 'x',
    },
  });
  waiter = { staffId: member.id, organizationId, restaurantId, role: 'waiter', name: 'Kelner' };
});

afterAll(async () => {
  if (organizationId) {
    // Płatności trzymają wizytę kluczem RESTRICT, więc kasujemy je pierwsze —
    // kaskada z organizacji sama tego nie zrobi.
    await direct.payment.deleteMany({ where: { organizationId } });
    await direct.organization.delete({ where: { id: organizationId } });
  }
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

let sessionCounter = 0;

/** Wizyta z gośćmi i jednym zamówieniem o zadanych pozycjach. */
async function visit(
  guests: { name: string; isHost?: boolean }[],
  lines: { forGuest?: number; amountCents: number }[],
) {
  sessionCounter += 1;
  const session = await direct.tableSession.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      sessionNumber: 1000 + sessionCounter,
      openedBy: 'guest',
      currency: 'PLN',
      businessDate: new Date(),
    },
  });

  const participants = [];
  for (const guest of guests) {
    participants.push(
      await direct.tableParticipant.create({
        data: {
          organizationId,
          tableSessionId: session.id,
          displayName: guest.name,
          symbol: 'star',
          color: '#111111',
          isHost: guest.isHost ?? false,
          createdBy: 'guest',
        },
      }),
    );
  }

  const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const order = await direct.order.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      tableSessionId: session.id,
      orderNumber: 1000 + sessionCounter,
      source: 'guest',
      status: 'confirmed',
      paymentStatus: 'awaiting_settlement',
      currency: 'PLN',
      businessDate: new Date(),
      subtotalCents: totalCents,
      totalCents,
      items: {
        create: lines.map((line, index) => ({
          organizationId,
          nameSnapshot: `Pozycja ${index + 1}`,
          quantity: 1,
          unitPriceCents: line.amountCents,
          vatRate: new Prisma.Decimal('0.0800'),
          addedBy: 'guest',
          forParticipantId:
            line.forGuest === undefined ? null : (participants[line.forGuest]?.id ?? null),
        })),
      },
    },
  });

  await direct.tableSession.update({
    where: { id: session.id },
    data: { subtotalCents: totalCents, totalCents },
  });

  return { session, participants, order, totalCents };
}

describe('niezmiennik podziału', () => {
  it('suma grup równa się kwocie rachunku przy kwocie niepodzielnej', async () => {
    // 100,01 zł na troje — 3333,67 grosza na głowę, czyli grosz do rozdania.
    const { session, totalCents } = await visit(
      [{ name: 'Ala', isHost: true }, { name: 'Bo' }, { name: 'Cyd' }],
      [{ amountCents: 10001 }],
    );

    const plan = await split.setMode(waiter, session.id, { splitMode: 'equal' });
    const suma = plan.groups.reduce((acc, group) => acc + group.totalCents, 0);

    expect(suma).toBe(totalCents);
    expect(plan.groups).toHaveLength(3);
  });

  it('nierozdzielony grosz trafia do hosta', async () => {
    const { session, participants } = await visit(
      [{ name: 'Zosia', isHost: true }, { name: 'Adam' }],
      [{ amountCents: 1001 }],
    );

    const plan = await split.setMode(waiter, session.id, { splitMode: 'equal' });
    const host = participants.find((participant) => participant.isHost)!;
    const grupaHosta = plan.groups.find((group) =>
      group.members.some((member) => member.id === host.id),
    )!;

    // Host bierze 501, drugi 500 — mimo że alfabetycznie „Adam" jest pierwszy.
    expect(grupaHosta.totalCents).toBe(501);
  });

  it('dzieli po 1 groszu bez gubienia reszty na wielu gościach', () => {
    const groups = Array.from({ length: 7 }, (_, index) => ({
      id: `g${index}`,
      participantIds: [`p${index}`],
      hasHost: index === 0,
    }));
    const plan = planSplit({
      mode: 'equal',
      totalCents: 100,
      groups,
      attributedByParticipant: {},
      unattributedCents: 0,
    });

    expect(plan.reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(100);
  });
});

describe('każdy za siebie', () => {
  it('liczy pozycje przypisane do gościa i dzieli wspólne po równo', async () => {
    const { session, participants, totalCents } = await visit(
      [{ name: 'Ala', isHost: true }, { name: 'Bo' }],
      [
        { forGuest: 0, amountCents: 4000 },
        { forGuest: 1, amountCents: 2000 },
        // Wspólna butelka bez adresata — po równo.
        { amountCents: 1000 },
      ],
    );

    const plan = await split.setMode(waiter, session.id, { splitMode: 'per_person' });
    const grupa = (participantId: string) =>
      plan.groups.find((group) => group.members.some((member) => member.id === participantId))!;

    expect(grupa(participants[0]!.id).totalCents).toBe(4000 + 500);
    expect(grupa(participants[1]!.id).totalCents).toBe(2000 + 500);
    expect(plan.groups.reduce((sum, group) => sum + group.totalCents, 0)).toBe(totalCents);
  });

  it('odmawia podziału, gdy wizyta nie ma gości', async () => {
    const { session } = await visit([], [{ amountCents: 5000 }]);

    await expect(split.setMode(waiter, session.id, { splitMode: 'per_person' })).rejects.toThrow(
      'Wizyta nie ma gości',
    );
  });
});

describe('grupy', () => {
  it('sumuje pozycje uczestników grupy i dokłada równą część wspólnych', async () => {
    const { session, participants, totalCents } = await visit(
      [{ name: 'Ala', isHost: true }, { name: 'Bo' }, { name: 'Cyd' }],
      [
        { forGuest: 0, amountCents: 3000 },
        { forGuest: 1, amountCents: 2000 },
        { forGuest: 2, amountCents: 1000 },
        { amountCents: 600 },
      ],
    );

    const plan = await split.setMode(waiter, session.id, {
      splitMode: 'groups',
      groups: [
        { label: 'Para', participantIds: [participants[0]!.id, participants[1]!.id] },
        { label: 'Cyd', participantIds: [participants[2]!.id] },
      ],
    });

    const para = plan.groups.find((group) => group.label === 'Para')!;
    const cyd = plan.groups.find((group) => group.label === 'Cyd')!;

    expect(para.totalCents).toBe(3000 + 2000 + 300);
    expect(cyd.totalCents).toBe(1000 + 300);
    expect(para.totalCents + cyd.totalCents).toBe(totalCents);
  });

  it('nie pozwala pominąć gościa ani wpisać go dwa razy', async () => {
    const { session, participants } = await visit(
      [{ name: 'Ala', isHost: true }, { name: 'Bo' }],
      [{ amountCents: 1000 }],
    );

    await expect(
      split.setMode(waiter, session.id, {
        splitMode: 'groups',
        groups: [{ participantIds: [participants[0]!.id] }],
      }),
    ).rejects.toThrow('Każdy gość musi trafić do jakiejś grupy');

    await expect(
      split.setMode(waiter, session.id, {
        splitMode: 'groups',
        groups: [
          { participantIds: [participants[0]!.id, participants[1]!.id] },
          { participantIds: [participants[1]!.id] },
        ],
      }),
    ).rejects.toThrow('Gość może należeć tylko do jednej grupy.');
  });
});

describe('rozliczanie grup', () => {
  it('zamyka wizytę dopiero, gdy zapłaciły wszystkie grupy', async () => {
    const { session, totalCents } = await visit(
      [{ name: 'Ala', isHost: true }, { name: 'Bo' }],
      [{ amountCents: 6000 }],
    );

    const plan = await split.setMode(waiter, session.id, { splitMode: 'equal' });
    const [pierwsza, druga] = plan.groups;

    const po1 = await split.settleGroup(waiter, session.id, pierwsza!.id, 'cash');
    expect(po1.status).toBe('awaiting_settlement');
    expect(po1.paidCents).toBe(3000);
    expect(po1.dueCents).toBe(3000);

    const po2 = await split.settleGroup(waiter, session.id, druga!.id, 'card_terminal');
    expect(po2.status).toBe('closed');
    expect(po2.paidCents).toBe(totalCents);
    expect(po2.dueCents).toBe(0);

    const zamowienia = await direct.order.findMany({ where: { tableSessionId: session.id } });
    expect(zamowienia.every((order) => order.paymentStatus === 'settled')).toBe(true);
  });

  it('nie rozlicza tej samej grupy dwa razy', async () => {
    const { session } = await visit(
      [{ name: 'Ala', isHost: true }, { name: 'Bo' }],
      [{ amountCents: 4000 }],
    );
    const plan = await split.setMode(waiter, session.id, { splitMode: 'equal' });
    const grupa = plan.groups[0]!;

    await split.settleGroup(waiter, session.id, grupa.id, 'cash');
    await expect(split.settleGroup(waiter, session.id, grupa.id, 'cash')).rejects.toThrow(
      'Ta grupa jest już rozliczona.',
    );
  });

  it('zamraża podział po pierwszej płatności', async () => {
    const { session } = await visit(
      [{ name: 'Ala', isHost: true }, { name: 'Bo' }],
      [{ amountCents: 4000 }],
    );
    const plan = await split.setMode(waiter, session.id, { splitMode: 'equal' });
    await split.settleGroup(waiter, session.id, plan.groups[0]!.id, 'cash');

    // Przeliczenie kwoty komuś, kto już zapłacił, byłoby cichą zmianą rachunku.
    await expect(split.setMode(waiter, session.id, { splitMode: 'per_person' })).rejects.toThrow(
      'Rachunek jest już częściowo zapłacony',
    );
  });
});

describe('przeliczanie przy zmianie rachunku', () => {
  it('aktualizuje kwoty grup, dopóki nikt nie zapłacił', async () => {
    const { session, order } = await visit(
      [{ name: 'Ala', isHost: true }, { name: 'Bo' }],
      [{ amountCents: 4000 }],
    );
    await split.setMode(waiter, session.id, { splitMode: 'equal' });

    // Kelner dokłada kawę po ustaleniu podziału.
    await direct.orderItem.create({
      data: {
        organizationId,
        orderId: order.id,
        nameSnapshot: 'Kawa',
        quantity: 1,
        unitPriceCents: 1000,
        vatRate: new Prisma.Decimal('0.2300'),
        addedBy: 'staff',
      },
    });
    await direct.order.update({
      where: { id: order.id },
      data: { subtotalCents: 5000, totalCents: 5000 },
    });
    await direct.tableSession.update({
      where: { id: session.id },
      data: { subtotalCents: 5000, totalCents: 5000 },
    });

    const plan = await split.get(waiter, session.id);
    expect(plan.groups.map((group) => group.totalCents)).toEqual([2500, 2500]);
    expect(plan.locked).toBe(false);
  });
});
