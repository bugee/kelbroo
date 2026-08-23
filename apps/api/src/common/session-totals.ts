import { Prisma } from '@prisma/client';

/**
 * Kwoty wizyty to suma zamówień innych niż odrzucone i anulowane.
 *
 * `TableSession` jest jednostką rachunku, więc suma liczy się tutaj, nie na
 * `Order` — jedna wizyta bywa złożona z kilku zamówień i kilku urządzeń gości.
 */
export async function recalculateSessionTotals(
  tx: Prisma.TransactionClient,
  tableSessionId: string,
  options: { touchLastSeen?: boolean } = {},
) {
  const aggregate = await tx.order.aggregate({
    where: { tableSessionId, status: { notIn: ['rejected', 'canceled'] } },
    _sum: { subtotalCents: true, vatCents: true, totalCents: true },
  });

  return tx.tableSession.update({
    where: { id: tableSessionId },
    data: {
      subtotalCents: aggregate._sum.subtotalCents ?? 0,
      vatCents: aggregate._sum.vatCents ?? 0,
      totalCents: aggregate._sum.totalCents ?? 0,
      // `lastSeenAt` oznacza aktywność gościa, więc edycja przez kelnera go nie rusza.
      ...(options.touchLastSeen ? { lastSeenAt: new Date() } : {}),
    },
  });
}
