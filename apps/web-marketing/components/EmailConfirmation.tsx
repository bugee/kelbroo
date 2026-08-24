'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { resendVerification, verifyEmail } from '@/lib/api';

type Stan = { faza: 'sprawdzam' } | { faza: 'gotowe' } | { faza: 'blad'; powod: string };

/**
 * Ekran, na który prowadzi odnośnik z wiadomości.
 *
 * Potwierdzenie dzieje się od razu po wejściu — kazanie klientowi kliknąć jeszcze
 * raz na stronie, na którą właśnie kliknął, byłoby żądaniem tego samego dwa razy.
 */
export function EmailConfirmation() {
  const token = useSearchParams().get('token');
  const [stan, setStan] = useState<Stan>({ faza: 'sprawdzam' });
  const [ponowione, setPonowione] = useState(false);

  useEffect(() => {
    if (!token) {
      setStan({ faza: 'blad', powod: 'Ten odnośnik jest niekompletny.' });
      return;
    }
    verifyEmail(token)
      .then(() => setStan({ faza: 'gotowe' }))
      .catch((przyczyna: unknown) =>
        setStan({
          faza: 'blad',
          powod: przyczyna instanceof Error ? przyczyna.message : 'Nie udało się potwierdzić.',
        }),
      );
  }, [token]);

  if (stan.faza === 'sprawdzam') {
    return (
      <p className="mono" style={{ marginTop: '24px', color: 'var(--muted)' }}>
        Sprawdzam odnośnik…
      </p>
    );
  }

  if (stan.faza === 'gotowe') {
    return (
      <div
        className="split-card"
        style={{ marginTop: '24px', borderColor: 'var(--teal)', background: 'var(--teal-wash)' }}
      >
        <h1 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, marginBottom: '8px' }}>
          Adres potwierdzony
        </h1>
        <p style={{ color: 'var(--ink-2)', marginBottom: '18px' }}>
          Możesz zalogować się do panelu i dodać pierwsze pozycje karty.
        </p>
        <a className="btn btn-primary" href="https://panel.kelbroo.com">
          Przejdź do panelu
        </a>
      </div>
    );
  }

  return (
    <div className="split-card" style={{ marginTop: '24px', borderColor: 'var(--orange)' }}>
      <h1 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, marginBottom: '8px' }}>
        Nie udało się potwierdzić
      </h1>
      <p style={{ color: 'var(--ink-2)', marginBottom: '18px' }}>{stan.powod}</p>

      {/*
        Wysyłka nowego odnośnika wprost stąd. Klient trafił tu z wygasłym linkiem
        i odesłanie go do formularza logowania po nowy byłoby drogą naokoło.
      */}
      {ponowione ? (
        <p className="mono" style={{ fontSize: 'var(--fs-sm)', color: 'var(--teal)' }}>
          Jeśli konto z tym adresem istnieje, nowy odnośnik już do niego poszedł.
        </p>
      ) : (
        <form
          onSubmit={(zdarzenie) => {
            zdarzenie.preventDefault();
            const adres = String(new FormData(zdarzenie.currentTarget).get('email') ?? '');
            void resendVerification(adres).finally(() => setPonowione(true));
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>Wyślemy nowy odnośnik</label>
          <input
            name="email"
            type="email"
            required
            placeholder="adres e-mail konta"
            style={{
              minHeight: '48px',
              padding: '0 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--line-strong)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              font: 'inherit',
            }}
          />
          <button type="submit" className="btn btn-ghost">
            Wyślij ponownie
          </button>
        </form>
      )}
    </div>
  );
}
