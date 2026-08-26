'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { Operacje } from '@/components/Operacje';
import { dzien, fetchClient, type KartaKlienta } from '@/lib/api';

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Shell>{() => <Karta id={id} />}</Shell>;
}

/**
 * Wszystko o jednym kliencie w jednym miejscu.
 *
 * Kolejność bloków odpowiada temu, po co ktoś tu wchodzi: najpierw stan konta
 * (czy działa i do kiedy), potem operacje, dopiero na końcu szczegóły i historia.
 * Wchodzi się tu zwykle z konkretnym pytaniem, nie żeby poczytać.
 */
function Karta({ id }: { id: string }) {
  const [karta, setKarta] = useState<KartaKlienta | null>(null);
  const [blad, setBlad] = useState<string | null>(null);

  const wczytaj = useCallback(async () => {
    try {
      setKarta(await fetchClient(id));
      setBlad(null);
    } catch (przyczyna) {
      setBlad(przyczyna instanceof Error ? przyczyna.message : 'Nie udało się wczytać.');
    }
  }, [id]);

  useEffect(() => {
    void wczytaj();
  }, [wczytaj]);

  if (blad) return <p className="text-[var(--orange)]">{blad}</p>;
  if (!karta) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  return (
    <>
      <Link href="/" className="mono text-sm text-[var(--teal)] underline">
        ← wszyscy klienci
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-xl">{karta.nazwa}</h1>
        <span className="mono text-sm text-[var(--muted)]">
          {karta.nip ?? 'bez NIP-u'} · {karta.emailRozliczeniowy} · od {dzien(karta.zalozone)}
        </span>
      </div>

      {/* Blokada na samej górze: to jedyny stan, przy którym nic innego nie ma
          znaczenia, dopóki się go nie zdejmie. */}
      {karta.zablokowane && (
        <p
          role="alert"
          className="mono mt-3 rounded-[var(--radius-control)] border border-[var(--orange)] bg-[var(--orange-wash)] px-3 py-2 text-sm"
        >
          <strong>Konto zablokowane</strong> {dzien(karta.zablokowane)}
          {karta.powodBlokady && ` — ${karta.powodBlokady}`}
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Sekcja tytul="Abonament">
            <Wiersz nazwa="Plan">
              {karta.abonament.plan ?? 'brak'}
              {karta.abonament.tableLimit !== null &&
                ` · limit ${karta.abonament.tableLimit} stolików, ${karta.abonament.languageLimit} języków`}
            </Wiersz>
            <Wiersz nazwa="Status">
              {karta.abonament.status}
              {karta.abonament.trial && ' (okres próbny)'}
            </Wiersz>
            <Wiersz nazwa="Aktywny do">
              {dzien(karta.abonament.currentPeriodEnd)}
              {karta.abonament.daysLeft !== null &&
                ` · ${
                  karta.abonament.daysLeft >= 0
                    ? `${karta.abonament.daysLeft} dni`
                    : `${-karta.abonament.daysLeft} dni po terminie`
                }`}
            </Wiersz>
            <Wiersz nazwa="Zamawianie">
              {karta.zablokowane ? (
                <span className="text-[var(--orange)]">wstrzymane — blokada</span>
              ) : karta.abonament.active ? (
                'działa'
              ) : (
                <span className="text-[var(--orange)]">wstrzymane — abonament</span>
              )}
            </Wiersz>
          </Sekcja>

          <Sekcja tytul="Lokale">
            {karta.lokale.map((lokal) => (
              <Wiersz key={lokal.id} nazwa={lokal.nazwa}>
                {lokal.stolikow} stolików · {lokal.pozycjiWKarcie} pozycji w karcie ·{' '}
                {lokal.trybZamawiania}
              </Wiersz>
            ))}
          </Sekcja>

          <Sekcja tytul="Personel">
            {karta.personel.map((osoba) => (
              <Wiersz key={osoba.id} nazwa={`${osoba.imie} · ${osoba.rola}`}>
                {osoba.email}
                {!osoba.potwierdzony && (
                  <span className="text-[var(--orange)]"> · adres niepotwierdzony</span>
                )}
                {!osoba.aktywne && ' · konto wyłączone'}
                {' · '}
                {osoba.ostatnieLogowanie ? (
                  `ostatnio ${dzien(osoba.ostatnieLogowanie)}`
                ) : (
                  <span className="text-[var(--orange)]">nigdy się nie logował</span>
                )}
              </Wiersz>
            ))}
          </Sekcja>

          <Sekcja tytul="Zgody">
            <Wiersz nazwa="Regulamin">
              {karta.regulamin.zaakceptowany
                ? `${dzien(karta.regulamin.zaakceptowany)} · wersja ${karta.regulamin.wersja}`
                : 'brak zapisanej zgody (konto sprzed formularza rejestracji)'}
            </Wiersz>
            <Wiersz nazwa="Polityka prywatności">
              {karta.prywatnosc.zaakceptowana
                ? `${dzien(karta.prywatnosc.zaakceptowana)} · wersja ${karta.prywatnosc.wersja}`
                : 'brak zapisanej zgody'}
            </Wiersz>
          </Sekcja>

          <Sekcja tytul="Historia operacji">
            {karta.historia.length === 0 ? (
              <p className="mono px-3 py-2 text-sm text-[var(--muted)]">
                Nikt jeszcze nic nie zmieniał na tym koncie.
              </p>
            ) : (
              karta.historia.map((wpis) => (
                <Wiersz key={wpis.id} nazwa={dzien(wpis.kiedy)}>
                  {wpis.akcja}
                  {wpis.powod && ` — ${wpis.powod}`}
                </Wiersz>
              ))
            )}
          </Sekcja>
        </div>

        <Operacje karta={karta} onZmiana={() => void wczytaj()} />
      </div>
    </>
  );
}

function Sekcja({ tytul, children }: { tytul: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)]">
      <h2 className="mono border-b border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">
        {tytul}
      </h2>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function Wiersz({ nazwa, children }: { nazwa: string; children: React.ReactNode }) {
  return (
    <p className="flex flex-wrap gap-x-3 border-b border-[var(--line)] px-3 py-2 text-sm last:border-0">
      <span className="mono w-44 shrink-0 text-xs text-[var(--muted)]">{nazwa}</span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}
