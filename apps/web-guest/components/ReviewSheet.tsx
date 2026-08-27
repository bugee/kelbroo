'use client';

import { useState } from 'react';
import { submitReview, type Reviewable } from '@/lib/api';

/**
 * Gwiazdki. Przyciski, nie ikonki — trafia w nie kciuk przy stoliku,
 * a czytnik ekranu musi umieć powiedzieć, co się wybiera.
 */
function Gwiazdki({
  wartosc,
  onZmiana,
  etykieta,
}: {
  wartosc: number;
  onZmiana: (ocena: number) => void;
  etykieta: string;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label={etykieta}>
      {[1, 2, 3, 4, 5].map((ocena) => (
        <button
          key={ocena}
          type="button"
          aria-label={`${ocena} z 5`}
          aria-pressed={wartosc === ocena}
          onClick={() => onZmiana(ocena)}
          className={`min-h-11 min-w-11 rounded-[var(--radius-control)] text-xl ${
            ocena <= wartosc ? 'text-[var(--orange)]' : 'text-[var(--line-strong)]'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/**
 * Ocena po posiłku.
 *
 * Sens tego ekranu nie leży w gwiazdkach, tylko w tym, co robi z niezadowolonym
 * gościem: daje mu miejsce, w którym powie o tym **restauracji**, zanim powie
 * o tym internetowi. Dlatego przy niskiej ocenie nie ma tu żadnej zachęty do
 * publicznej recenzji — jest zapewnienie, że wiadomość trafi do managera.
 *
 * Wszystko jest opcjonalne poza jedną gwiazdką: gość ma wyjść z restauracji,
 * a nie wypełnić ankietę.
 */
export function ReviewSheet({
  qrToken,
  reviewable,
  onClose,
  onDone,
}: {
  qrToken: string;
  reviewable: Reviewable;
  onClose: () => void;
  onDone: () => void;
}) {
  const [dania, setDania] = useState<Record<string, number>>({});
  const [wizyta, setWizyta] = useState(0);
  const [adresat, setAdresat] = useState<'kitchen' | 'service'>('kitchen');
  const [komentarz, setKomentarz] = useState('');
  const [wysylanie, setWysylanie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [gotowe, setGotowe] = useState(false);

  const cokolwiek = wizyta > 0 || Object.keys(dania).length > 0;

  const wyslij = async () => {
    setWysylanie(true);
    setBlad(null);
    try {
      await submitReview(qrToken, {
        dishes: Object.entries(dania).map(([menuItemId, rating]) => ({ menuItemId, rating })),
        visit: wizyta > 0 ? { rating: wizyta, target: adresat, comment: komentarz } : undefined,
      });
      setGotowe(true);
      onDone();
    } catch (przyczyna) {
      setBlad(przyczyna instanceof Error ? przyczyna.message : 'Nie udało się wysłać oceny.');
    } finally {
      setWysylanie(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="max-h-[88dvh] overflow-y-auto rounded-t-[var(--radius-card)] bg-[var(--surface)] p-5 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--line-strong)]" />

        {gotowe ? (
          <div role="status">
            <h2 className="text-xl">Dziękujemy</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {wizyta > 0 && wizyta <= 2
                ? 'Twoja wiadomość trafiła prosto do managera lokalu. Nikt poza obsługą jej nie zobaczy.'
                : 'Przekazaliśmy Twoją ocenę obsłudze.'}
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-xl">Jak było?</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ocena jest anonimowa i zostaje w lokalu. Wystawiasz ją raz.
            </p>

            {reviewable.dishes.length > 0 && (
              <section className="mt-5">
                <h3 className="text-sm font-semibold">Twoje dania</h3>
                <ul className="mt-2 flex flex-col gap-3">
                  {reviewable.dishes.map((danie) => (
                    <li key={danie.menuItemId} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 text-sm">{danie.name}</span>
                      <Gwiazdki
                        etykieta={`Ocena: ${danie.name}`}
                        wartosc={dania[danie.menuItemId] ?? 0}
                        onZmiana={(ocena) =>
                          setDania((current) => ({ ...current, [danie.menuItemId]: ocena }))
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-5">
              <h3 className="text-sm font-semibold">Cała wizyta</h3>
              <div className="mt-2">
                <Gwiazdki etykieta="Ocena wizyty" wartosc={wizyta} onZmiana={setWizyta} />
              </div>

              {wizyta > 0 && (
                <>
                  {/* Dwaj adresaci, bo to dwie różne rozmowy: o jedzeniu rozmawia
                      kuchnia, o czekaniu i atmosferze — obsługa. */}
                  <div className="mt-3 flex gap-2" role="group" aria-label="Czego dotyczy">
                    {(
                      [
                        ['kitchen', 'O jedzeniu'],
                        ['service', 'O obsłudze'],
                      ] as const
                    ).map(([wartosc, etykieta]) => (
                      <button
                        key={wartosc}
                        type="button"
                        aria-pressed={adresat === wartosc}
                        onClick={() => setAdresat(wartosc)}
                        className={`mono min-h-11 flex-1 rounded-[var(--radius-control)] border text-sm ${
                          adresat === wartosc
                            ? 'border-[var(--teal)] bg-[var(--teal-wash)] text-[var(--teal)]'
                            : 'border-[var(--line)] text-[var(--muted)]'
                        }`}
                      >
                        {etykieta}
                      </button>
                    ))}
                  </div>

                  <label className="mt-3 block">
                    <span className="text-sm font-semibold">Wiadomość do managera</span>
                    <textarea
                      value={komentarz}
                      onChange={(zdarzenie) => setKomentarz(zdarzenie.target.value)}
                      rows={3}
                      maxLength={1000}
                      placeholder="Nieobowiązkowo — napisz, co warto poprawić albo pochwalić."
                      className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--line-strong)] bg-[var(--surface)] p-3 text-sm"
                    />
                  </label>
                  <p className="text-xs text-[var(--muted)]">
                    Trafia wyłącznie do panelu lokalu. Nie publikujemy jej nigdzie.
                  </p>
                </>
              )}
            </section>

            {blad && (
              <p role="alert" className="mt-3 text-sm text-[var(--orange)]">
                {blad}
              </p>
            )}

            <button
              type="button"
              disabled={!cokolwiek || wysylanie}
              onClick={() => void wyslij()}
              className="mono mt-5 min-h-12 w-full rounded-[var(--radius-control)] bg-[var(--orange)] font-bold text-white disabled:opacity-40"
            >
              {wysylanie ? 'Wysyłam…' : 'Wyślij ocenę'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
