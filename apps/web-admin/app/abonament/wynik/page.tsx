'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StaffShell } from '@/components/StaffShell';
import { fetchOrderStatus, money } from '@/lib/api';

export default function ResultPage() {
  return (
    <StaffShell>
      {() => (
        <Suspense fallback={<p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>}>
          <Wynik />
        </Suspense>
      )}
    </StaffShell>
  );
}

type Stan = Awaited<ReturnType<typeof fetchOrderStatus>>;

/** Ile razy pytamy o wynik, zanim odeślemy klienta do skrzynki. */
const PROB = 20;
const ODSTEP_MS = 1_500;

/**
 * Powrót z bramki płatniczej.
 *
 * Ten ekran **nie wie**, czy zapłacono — wie to serwer, po podpisanym
 * powiadomieniu od operatora. Powrót przeglądarki jest tylko sygnałem, że warto
 * zapytać: klient mógł zamknąć bramkę, cofnąć się albo trafić tu z historii.
 * Dlatego pytamy serwer w pętli zamiast czytać cokolwiek z adresu.
 */
function Wynik() {
  const params = useSearchParams();
  const externalId = params.get('zamowienie');
  // PayU dokleja `error` przy nieudanej płatności — sygnał, nie rozstrzygnięcie.
  const zgloszonyBlad = params.get('error');

  const [stan, setStan] = useState<Stan | null>(null);
  const [czekamy, setCzekamy] = useState(true);
  const [blad, setBlad] = useState<string | null>(null);
  const proby = useRef(0);

  const sprawdz = useCallback(async () => {
    if (!externalId) return true;
    try {
      const wynik = await fetchOrderStatus(externalId);
      setStan(wynik);
      return wynik.status === 'completed' || wynik.status === 'canceled';
    } catch (cause) {
      setBlad(cause instanceof Error ? cause.message : 'Nie udało się sprawdzić płatności.');
      return true;
    }
  }, [externalId]);

  useEffect(() => {
    if (!externalId) {
      setCzekamy(false);
      return;
    }

    let zywy = true;
    const tik = async () => {
      if (!zywy) return;
      const koniec = await sprawdz();
      proby.current += 1;
      if (!zywy) return;
      if (koniec || proby.current >= PROB) {
        setCzekamy(false);
        return;
      }
      setTimeout(() => void tik(), ODSTEP_MS);
    };

    void tik();
    return () => {
      zywy = false;
    };
  }, [externalId, sprawdz]);

  if (!externalId) {
    return (
      <Ramka naglowek="Nie wiemy, o którą płatność chodzi">
        <p>Otwórz ekran abonamentu, żeby sprawdzić stan.</p>
        <Powrot />
      </Ramka>
    );
  }

  if (stan?.status === 'completed') {
    return (
      <Ramka naglowek="Płatność przyjęta">
        <p>
          Abonament <strong className="uppercase">{stan.plan}</strong> jest opłacony do{' '}
          <strong>
            {stan.paidUntil ? new Date(stan.paidUntil).toLocaleDateString('pl-PL') : '—'}
          </strong>
          .
        </p>
        <p className="mt-2 text-[var(--muted)]">
          Potwierdzenie wysłaliśmy mailem. Fakturę VAT dostaniesz w ciągu kilku dni roboczych.
        </p>
        <Powrot />
      </Ramka>
    );
  }

  if (stan?.status === 'canceled' || zgloszonyBlad) {
    return (
      <Ramka naglowek="Płatność nie doszła do skutku">
        <p>
          Nic nie zostało pobrane
          {stan ? ` — zamówienie na ${money(stan.grossCents, stan.currency)} przepadło` : ''}.
          Możesz spróbować ponownie.
        </p>
        <Powrot etykieta="Wróć do abonamentu" />
      </Ramka>
    );
  }

  if (czekamy) {
    return (
      <Ramka naglowek="Sprawdzamy płatność">
        <p>
          Czekamy na potwierdzenie od operatora. To zwykle kilka sekund — nie zamykaj tej strony.
        </p>
      </Ramka>
    );
  }

  return (
    <Ramka naglowek="Potwierdzenie jeszcze nie dotarło">
      <p>
        Operator nie potwierdził jeszcze płatności. Jeśli pieniądze zostały pobrane, abonament
        przedłuży się sam, a potwierdzenie przyjdzie mailem.
      </p>
      {blad && <p className="mt-2 text-[var(--orange)]">{blad}</p>}
      <p className="mt-2 text-[var(--muted)]">
        Gdyby nic się nie zmieniło w ciągu godziny, napisz na kontakt@kelbroo.com — numer płatności:{' '}
        <span className="mono">{externalId}</span>
      </p>
      <Powrot />
    </Ramka>
  );
}

function Ramka({ naglowek, children }: { naglowek: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-lg rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-6 text-sm">
      <h1 className="mb-3 font-[family-name:var(--font-display)] text-xl font-bold">{naglowek}</h1>
      {children}
    </section>
  );
}

function Powrot({ etykieta = 'Wróć do panelu' }: { etykieta?: string }) {
  return (
    <Link
      href="/abonament"
      className="mono mt-4 inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-[var(--teal)] px-4 font-semibold text-white"
    >
      {etykieta}
    </Link>
  );
}
