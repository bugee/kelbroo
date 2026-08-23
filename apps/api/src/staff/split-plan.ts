import { allocateEqually, assertAllocationSumsTo, MoneySplitError } from '@kelbroo/types';
import type { SplitMode } from '@kelbroo/types';

export interface SplitGroupInput {
  id: string;
  participantIds: string[];
  /** Czy w grupie jest host — do niego trafiają nierozdzielone grosze. */
  hasHost: boolean;
}

export interface SplitPlanInput {
  mode: SplitMode;
  totalCents: number;
  groups: SplitGroupInput[];
  /** Kwoty pozycji mających adresata, po `order_item.for_participant_id`. */
  attributedByParticipant: Record<string, number>;
  /** Pozycje bez adresata — wspólna butelka, zamówienie „na stolik". */
  unattributedCents: number;
}

export interface SplitPlanEntry {
  groupId: string;
  amountCents: number;
  /** Ile z tego pochodzi z pozycji przypisanych wprost do uczestników grupy. */
  attributedCents: number;
  /** A ile z równego podziału pozycji bez adresata. */
  sharedCents: number;
}

/**
 * Rozkłada rachunek wizyty na grupy rozliczeniowe.
 *
 * Grupa jest jednostką płatności we wszystkich trybach poza `none`; `per_person`
 * to po prostu grupy jednoosobowe. Reguła jest jedna dla `per_person` i `groups`:
 * grupa płaci za to, co zamówiono dla jej uczestników, plus równą część pozycji
 * bez adresata. Tryb `equal` ignoruje przypisania i dzieli całość po równo.
 *
 * Niezmiennik pilnowany na wyjściu: suma grup równa się kwocie rachunku co do
 * grosza. Podział, który się nie sumuje, nie ma prawa trafić do bazy.
 */
export function planSplit(input: SplitPlanInput): SplitPlanEntry[] {
  const { mode, totalCents, groups } = input;

  if (mode === 'none') {
    throw new MoneySplitError('Tryb `none` nie tworzy grup rozliczeniowych.');
  }
  if (mode === 'per_item') {
    // OrderItemShare należy do etapu 2 — dzielenie jednej pozycji między gości
    // jest najbardziej złożoną arytmetycznie częścią i świadomie czeka.
    throw new MoneySplitError('Podział po pozycjach będzie dostępny z płatnościami online.');
  }
  if (groups.length === 0) {
    throw new MoneySplitError('Brak grup do podziału rachunku.');
  }

  const keys = groups.map((group) => ({ key: group.id, isHost: group.hasHost }));

  if (mode === 'equal') {
    const allocations = allocateEqually(totalCents, keys);
    assertAllocationSumsTo(allocations, totalCents);
    return allocations.map((allocation) => ({
      groupId: allocation.key,
      amountCents: allocation.amountCents,
      attributedCents: 0,
      sharedCents: allocation.amountCents,
    }));
  }

  // Każdy uczestnik z przypisanymi pozycjami musi należeć do jakiejś grupy —
  // inaczej jego kwota wyparowałaby z rachunku bez śladu.
  const assigned = new Set(groups.flatMap((group) => group.participantIds));
  for (const participantId of Object.keys(input.attributedByParticipant)) {
    if (!assigned.has(participantId)) {
      throw new MoneySplitError(
        'Gość z pozycjami na rachunku nie należy do żadnej grupy — podział zgubiłby jego kwotę.',
      );
    }
  }

  const shared = allocateEqually(input.unattributedCents, keys);
  const sharedById = new Map(shared.map((allocation) => [allocation.key, allocation.amountCents]));

  const entries = groups.map((group) => {
    const attributedCents = group.participantIds.reduce(
      (sum, participantId) => sum + (input.attributedByParticipant[participantId] ?? 0),
      0,
    );
    const sharedCents = sharedById.get(group.id) ?? 0;
    return {
      groupId: group.id,
      attributedCents,
      sharedCents,
      amountCents: attributedCents + sharedCents,
    };
  });

  assertAllocationSumsTo(
    entries.map((entry) => ({ key: entry.groupId, amountCents: entry.amountCents })),
    totalCents,
  );
  return entries;
}
