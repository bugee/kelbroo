'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { StaffShell } from '@/components/StaffShell';
import {
  fetchSplit,
  money,
  setSplitMode,
  settleSplitGroup,
  type SplitMode,
  type SplitPlan,
} from '@/lib/api';

const MODE_LABEL: Record<SplitMode, string> = {
  none: 'Jeden rachunek',
  per_person: 'Każdy za siebie',
  equal: 'Po równo',
  groups: 'Grupami',
};

/** `per_item` należy do etapu 2 — dzielenie jednej pozycji czeka na płatności online. */
const MODES: SplitMode[] = ['none', 'per_person', 'equal', 'groups'];

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <StaffShell>{() => <Split sessionId={id} />}</StaffShell>;
}

function Split({ sessionId }: { sessionId: string }) {
  const [plan, setPlan] = useState<SplitPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<string[][] | null>(null);

  const load = useCallback(async () => {
    try {
      setPlan(await fetchSplit(sessionId));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się wczytać rachunku.');
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<SplitPlan>) => {
    setError(null);
    setBusy(true);
    try {
      setPlan(await action());
      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  if (error && !plan) return <p className="text-[var(--orange)]">{error}</p>;
  if (!plan) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  return (
    <div className="max-w-3xl">
      <Link href="/tables" className="text-sm text-[var(--muted)] underline">
        ← Sala
      </Link>

      <h1 className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold">
        {plan.tableLabel} · rachunek #{plan.number}
      </h1>

      <p className="mono mt-1 text-sm text-[var(--muted)]">
        {money(plan.totalCents, plan.currency)} razem · zapłacono{' '}
        {money(plan.paidCents, plan.currency)} · zostaje {money(plan.dueCents, plan.currency)}
      </p>

      {error && <p className="mt-3 text-[var(--orange)]">{error}</p>}

      {plan.locked && (
        <p className="mt-3 rounded-[var(--radius-control)] bg-[var(--orange-wash)] p-3 text-sm">
          Ktoś już zapłacił, więc podziału nie da się zmienić. Przeliczenie kwoty osobie, która
          uregulowała swoją część, byłoby cichą zmianą rachunku po fakcie.
        </p>
      )}

      <h2 className="mt-6 font-[family-name:var(--font-display)] font-bold">Sposób podziału</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={busy || plan.locked}
            onClick={() => {
              if (mode === 'groups') {
                // Skład grup wie tylko kelner — zaczynamy od jednej grupy ze wszystkimi.
                setDraft([plan.participants.map((participant) => participant.id)]);
                return;
              }
              void run(() => setSplitMode(sessionId, { splitMode: mode }));
            }}
            className={`min-h-12 rounded-[var(--radius-control)] border px-4 text-sm font-semibold disabled:opacity-40 ${
              plan.splitMode === mode
                ? 'border-[var(--teal)] bg-[var(--teal-wash)] text-[var(--teal)]'
                : 'border-[var(--line)]'
            }`}
          >
            {MODE_LABEL[mode]}
          </button>
        ))}
      </div>

      {draft && (
        <GroupBuilder
          plan={plan}
          draft={draft}
          setDraft={setDraft}
          busy={busy}
          onSave={(groups) =>
            void run(() => setSplitMode(sessionId, { splitMode: 'groups', groups }))
          }
          onCancel={() => setDraft(null)}
        />
      )}

      {plan.groups.length > 0 && (
        <>
          <h2 className="mt-8 font-[family-name:var(--font-display)] font-bold">Do zapłaty</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {plan.groups.map((group) => {
              const paid = group.status === 'paid' || group.status === 'settled';
              return (
                <li
                  key={group.id}
                  className={`flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-3 ${
                    paid ? 'opacity-60' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {group.label ?? group.members.map((member) => member.displayName).join(', ')}
                    </span>
                    <span className="block text-sm text-[var(--muted)]">
                      {group.members.map((member) => member.displayName).join(' · ')}
                    </span>
                  </span>

                  <span className="mono font-semibold">
                    {money(group.totalCents, plan.currency)}
                  </span>

                  {paid ? (
                    <span className="mono text-sm text-[var(--teal)]">zapłacone</span>
                  ) : (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(() => settleSplitGroup(sessionId, group.id, 'cash'))
                        }
                        className="min-h-11 rounded-[var(--radius-control)] border border-[var(--line)] px-4 text-sm font-semibold disabled:opacity-50"
                      >
                        Gotówka
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(() => settleSplitGroup(sessionId, group.id, 'card_terminal'))
                        }
                        className="min-h-11 rounded-[var(--radius-control)] border border-[var(--line)] px-4 text-sm font-semibold disabled:opacity-50"
                      >
                        Terminal
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="mono mt-2 text-xs text-[var(--muted)]">
            Suma grup:{' '}
            {money(
              plan.groups.reduce((sum, group) => sum + group.totalCents, 0),
              plan.currency,
            )}{' '}
            — musi zgadzać się z rachunkiem co do grosza.
          </p>
        </>
      )}

      {plan.splitMode === 'none' && plan.groups.length === 0 && (
        <p className="mt-6 text-sm text-[var(--muted)]">
          Rachunek nie jest podzielony — rozliczysz go w całości na ekranie sali.
        </p>
      )}
    </div>
  );
}

/** Ręczny skład grup: kto z kim płaci, wie wyłącznie kelner przy stoliku. */
function GroupBuilder({
  plan,
  draft,
  setDraft,
  busy,
  onSave,
  onCancel,
}: {
  plan: SplitPlan;
  draft: string[][];
  setDraft: (groups: string[][]) => void;
  busy: boolean;
  onSave: (groups: { participantIds: string[] }[]) => void;
  onCancel: () => void;
}) {
  const move = (participantId: string, toIndex: number) => {
    setDraft(
      draft.map((group, index) => {
        const without = group.filter((id) => id !== participantId);
        return index === toIndex ? [...without, participantId] : without;
      }),
    );
  };

  const assigned = new Set(draft.flat());
  const unassigned = plan.participants.filter((participant) => !assigned.has(participant.id));

  return (
    <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h3 className="font-[family-name:var(--font-display)] font-bold">Kto z kim płaci</h3>

      <ul className="mt-3 flex flex-col gap-3">
        {draft.map((group, index) => (
          <li
            key={index}
            className="rounded-[var(--radius-control)] border border-[var(--line)] p-3"
          >
            <span className="mono text-sm font-semibold text-[var(--muted)]">
              Grupa {index + 1}
            </span>
            <ul className="mt-2 flex flex-wrap gap-2">
              {plan.participants.map((participant) => {
                const here = group.includes(participant.id);
                return (
                  <li key={participant.id}>
                    <button
                      type="button"
                      onClick={() => move(participant.id, index)}
                      className={`min-h-11 rounded-full border px-3 text-sm ${
                        here
                          ? 'border-[var(--teal)] bg-[var(--teal-wash)] text-[var(--teal)]'
                          : 'border-[var(--line)] text-[var(--muted)]'
                      }`}
                    >
                      {participant.displayName}
                      {participant.isHost && ' ·host'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setDraft([...draft, []])}
        className="mt-3 min-h-11 rounded-[var(--radius-control)] border border-[var(--line)] px-4 text-sm font-semibold"
      >
        Dodaj grupę
      </button>

      {unassigned.length > 0 && (
        <p className="mt-3 text-sm text-[var(--orange)]">
          Bez grupy: {unassigned.map((participant) => participant.displayName).join(', ')} — każdy
          gość musi trafić do jakiejś grupy, inaczej jego część rachunku zniknie.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy || unassigned.length > 0 || draft.some((group) => group.length === 0)}
          onClick={() => onSave(draft.map((participantIds) => ({ participantIds })))}
          className="min-h-12 rounded-[var(--radius-control)] bg-[var(--teal)] px-5 font-semibold text-white disabled:opacity-50"
        >
          Zapisz podział
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-12 px-4 text-sm text-[var(--muted)] underline"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}
