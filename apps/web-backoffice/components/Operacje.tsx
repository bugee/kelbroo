'use client';

import { useState } from 'react';
import {
  blockClient,
  changePlan,
  setFeature,
  extendSubscription,
  unblockClient,
  type KartaKlienta,
  type Plan,
} from '@/lib/api';

const PLANY: Plan[] = ['menu', 'starter', 'pro', 'enterprise'];

/**
 * Operacje na koncie klienta.
 *
 * **Każda wymaga powodu** — pole nie jest formalnością. Zmiana planu albo blokada
 * bez zapisanego „dlaczego" jest po tygodniu nie do wyjaśnienia ani klientowi,
 * ani sobie, a to są decyzje o cudzych pieniądzach.
 *
 * Blokada stoi osobno, na dole i w pomarańczu: to jedyna operacja, która zatrzymuje
 * lokalowi sprzedaż.
 */
export function Operacje({ karta, onZmiana }: { karta: KartaKlienta; onZmiana: () => void }) {
  const [powod, setPowod] = useState('');
  const [dni, setDni] = useState(14);
  const [plan, setPlan] = useState<Plan>((karta.abonament.plan as Plan) ?? 'pro');
  const [pracuje, setPracuje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [gotowe, setGotowe] = useState<string | null>(null);

  const wykonaj = async (opis: string, akcja: () => Promise<unknown>) => {
    setPracuje(true);
    setBlad(null);
    setGotowe(null);
    try {
      await akcja();
      setPowod('');
      setGotowe(opis);
      onZmiana();
    } catch (przyczyna) {
      setBlad(przyczyna instanceof Error ? przyczyna.message : 'Nie udało się.');
    } finally {
      setPracuje(false);
    }
  };

  const id = karta.organizationId;
  const brakPowodu = powod.trim().length < 3;

  return (
    <aside className="flex h-max flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="mono text-xs font-semibold text-[var(--muted)]">Operacje</h2>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Powód</span>
        <input
          value={powod}
          onChange={(zdarzenie) => setPowod(zdarzenie.target.value)}
          placeholder="np. przedłużenie po rozmowie"
          className="min-h-10 rounded-[var(--radius-control)] border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm"
        />
        <span className="text-xs text-[var(--muted)]">
          Wymagany przy każdej operacji. Trafia do historii konta.
        </span>
      </label>

      <hr className="border-[var(--line)]" />

      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-semibold">Przedłuż o dni</span>
          <input
            type="number"
            min={1}
            max={365}
            value={dni}
            onChange={(zdarzenie) => setDni(Number(zdarzenie.target.value))}
            className="mono min-h-10 rounded-[var(--radius-control)] border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={pracuje || brakPowodu}
          onClick={() =>
            void wykonaj(`Przedłużono o ${dni} dni.`, () => extendSubscription(id, dni, powod))
          }
          className="min-h-10 rounded-[var(--radius-control)] bg-[var(--teal)] px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          Przedłuż
        </button>
      </div>

      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-semibold">Plan</span>
          <select
            value={plan}
            onChange={(zdarzenie) => setPlan(zdarzenie.target.value as Plan)}
            className="mono min-h-10 rounded-[var(--radius-control)] border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm"
          >
            {PLANY.map((nazwa) => (
              <option key={nazwa} value={nazwa}>
                {nazwa}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pracuje || brakPowodu}
          onClick={() =>
            void wykonaj(`Plan zmieniony na ${plan}.`, () => changePlan(id, plan, powod))
          }
          className="min-h-10 rounded-[var(--radius-control)] bg-[var(--teal)] px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          Zmień
        </button>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Zmiana planu przestawia też limity stolików, języków i kont personelu — oraz{' '}
        <strong>kasuje ręcznie włączone funkcje</strong> poniżej.
      </p>

      <hr className="border-[var(--line)]" />

      {/*
        Funkcja poza planem. Po co: lokal na Starterze prosi o zdjęcia dań na czas
        rozmowy o przejściu na Pro — i nie ma sensu przepisywać mu abonamentu,
        żeby to sprawdził.
      */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="mono text-sm">
          Zdjęcia dań:{' '}
          <strong className={karta.abonament.menuPhotosEnabled ? 'text-[var(--teal)]' : ''}>
            {karta.abonament.menuPhotosEnabled ? 'włączone' : 'wyłączone'}
          </strong>
        </span>
        <button
          type="button"
          disabled={pracuje || brakPowodu}
          onClick={() =>
            void wykonaj(
              karta.abonament.menuPhotosEnabled
                ? 'Zdjęcia dań wyłączone.'
                : 'Zdjęcia dań włączone.',
              () => setFeature(id, !karta.abonament.menuPhotosEnabled, powod),
            )
          }
          className="min-h-10 rounded-[var(--radius-control)] border border-[var(--line-strong)] px-4 text-sm font-semibold disabled:opacity-40"
        >
          {karta.abonament.menuPhotosEnabled ? 'Wyłącz' : 'Włącz'}
        </button>
      </div>

      <hr className="border-[var(--line)]" />

      {karta.zablokowane ? (
        <button
          type="button"
          disabled={pracuje || brakPowodu}
          onClick={() => void wykonaj('Konto odblokowane.', () => unblockClient(id, powod))}
          className="min-h-11 rounded-[var(--radius-control)] bg-[var(--teal)] text-sm font-semibold text-white disabled:opacity-40"
        >
          Odblokuj konto
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={pracuje || brakPowodu}
            onClick={() => void wykonaj('Konto zablokowane.', () => blockClient(id, powod))}
            className="min-h-11 rounded-[var(--radius-control)] bg-[var(--orange)] text-sm font-semibold text-white disabled:opacity-40"
          >
            Zablokuj konto
          </button>
          {/* Ludzie boją się tego przycisku bardziej, niż powinni — mówimy wprost,
              co robi i czego nie robi. */}
          <p className="text-xs text-[var(--muted)]">
            Wstrzymuje nowe zamówienia u gościa i w panelu. Rozliczanie otwartych rachunków działa
            dalej, a dane nie są kasowane.
          </p>
        </>
      )}

      {blad && (
        <p role="alert" className="text-sm text-[var(--orange)]">
          {blad}
        </p>
      )}
      {gotowe && <p className="text-sm text-[var(--teal)]">{gotowe}</p>}
    </aside>
  );
}
