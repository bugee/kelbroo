'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { dzien, fetchClients, type Klient } from '@/lib/api';

export default function ClientsPage() {
  return <Shell>{() => <Klienci />}</Shell>;
}

/**
 * Lista klientów platformy.
 *
 * Kolumny wybrane pod pytania, które faktycznie padają: kto to jest, na czym
 * jest, do kiedy i czy w ogóle zaczął korzystać. Ostatnie logowanie stoi obok
 * abonamentu celowo — klient na okresie próbnym, który nigdy się nie zalogował,
 * to telefon do wykonania, a nie faktura do wystawienia.
 */
function Klienci() {
  const [klienci, setKlienci] = useState<Klient[] | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [szukaj, setSzukaj] = useState('');

  const wczytaj = useCallback(async () => {
    try {
      setKlienci(await fetchClients());
    } catch (przyczyna) {
      setBlad(przyczyna instanceof Error ? przyczyna.message : 'Nie udało się wczytać.');
    }
  }, []);

  useEffect(() => {
    void wczytaj();
  }, [wczytaj]);

  if (blad) return <p className="text-[var(--orange)]">{blad}</p>;
  if (!klienci) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  const fraza = szukaj.trim().toLowerCase();
  const widoczni = fraza
    ? klienci.filter((klient) =>
        [
          klient.nazwa,
          klient.nip ?? '',
          klient.emailRozliczeniowy,
          ...klient.lokale.map((l) => l.nazwa),
        ]
          .join(' ')
          .toLowerCase()
          .includes(fraza),
      )
    : klienci;

  const proby = klienci.filter((klient) => klient.demo && klient.aktywny).length;
  const wygasli = klienci.filter((klient) => !klient.aktywny).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <h1 className="text-xl">Klienci</h1>
        <span className="mono text-sm text-[var(--muted)]">
          {klienci.length} razem · {proby} na okresie próbnym · {wygasli} bez aktywnego abonamentu
        </span>
        <input
          value={szukaj}
          onChange={(zdarzenie) => setSzukaj(zdarzenie.target.value)}
          placeholder="szukaj po nazwie, NIP-ie, adresie"
          className="mono ml-auto min-h-10 w-64 rounded-[var(--radius-control)] border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-sm"
        />
      </div>

      {widoczni.length === 0 ? (
        <p className="mt-12 text-center text-[var(--muted)]">
          {klienci.length === 0 ? 'Nie ma jeszcze żadnego klienta.' : 'Nic nie pasuje do frazy.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left">
                <Naglowek>Klient</Naglowek>
                <Naglowek>Abonament</Naglowek>
                <Naglowek>Aktywny do</Naglowek>
                <Naglowek>Lokale</Naglowek>
                <Naglowek>Ostatnie logowanie</Naglowek>
              </tr>
            </thead>
            <tbody>
              {widoczni.map((klient) => (
                <tr
                  key={klient.organizationId}
                  className="border-b border-[var(--line)] last:border-0"
                >
                  <td className="px-3 py-3 align-top">
                    <span className="block font-semibold">{klient.nazwa}</span>
                    <span className="mono block text-xs text-[var(--muted)]">
                      {klient.nip ?? 'bez NIP-u'} · {klient.emailRozliczeniowy}
                    </span>
                    <span className="mono block text-xs text-[var(--muted)]">
                      od {dzien(klient.zalozone)}
                      {/* Konta sprzed formularza rejestracji nie mają zapisanej zgody —
                          to widać tutaj, a nie dopiero przy sporze. */}
                      {!klient.regulaminZaakceptowany && ' · brak zapisanej zgody'}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <StanAbonamentu klient={klient} />
                  </td>
                  <td className="mono px-3 py-3 align-top">
                    {dzien(klient.aktywnyDo)}
                    {klient.dniDoKonca !== null && (
                      <span className="block text-xs text-[var(--muted)]">
                        {klient.dniDoKonca >= 0
                          ? `${klient.dniDoKonca} dni`
                          : `${-klient.dniDoKonca} dni po terminie`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top">
                    {klient.lokale.map((lokal) => (
                      <span key={lokal.id} className="block">
                        {lokal.nazwa}
                        <span className="mono text-xs text-[var(--muted)]">
                          {' '}
                          · {lokal.stolikow} st.
                        </span>
                      </span>
                    ))}
                    <span className="mono block text-xs text-[var(--muted)]">
                      {klient.pracownikow} kont personelu
                    </span>
                  </td>
                  <td className="mono px-3 py-3 align-top">
                    {klient.ostatnieLogowanie ? (
                      dzien(klient.ostatnieLogowanie)
                    ) : (
                      // Najważniejsza informacja na tej liście: klient, który
                      // założył konto i nigdy nie wszedł, potrzebuje telefonu.
                      <span className="text-[var(--orange)]">nigdy</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Naglowek({ children }: { children: React.ReactNode }) {
  return <th className="mono px-3 py-2 text-xs font-semibold text-[var(--muted)]">{children}</th>;
}

function StanAbonamentu({ klient }: { klient: Klient }) {
  const etykieta = klient.plan ?? 'brak planu';

  if (!klient.aktywny) {
    return (
      <span className="mono rounded-full bg-[var(--orange-wash)] px-2 py-1 text-xs text-[var(--orange)]">
        {etykieta} · nieaktywny
      </span>
    );
  }

  return (
    <span
      className={`mono rounded-full px-2 py-1 text-xs ${
        klient.demo
          ? 'bg-[var(--teal-wash)] text-[var(--teal)]'
          : 'bg-[var(--surface-2)] text-[var(--ink)]'
      }`}
    >
      {etykieta}
      {klient.demo ? ' · okres próbny' : ''}
    </span>
  );
}
