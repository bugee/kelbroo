'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Dictionary } from '@kelbroo/i18n';
import { resendVerification, verifyEmail } from '@/lib/api';

type Stan = { faza: 'sprawdzam' } | { faza: 'gotowe' } | { faza: 'blad'; powod: string };

/**
 * Ekran, na który prowadzi odnośnik z wiadomości.
 *
 * Potwierdzenie dzieje się od razu po wejściu — kazanie klientowi kliknąć jeszcze
 * raz na stronie, na którą właśnie kliknął, byłoby żądaniem tego samego dwa razy.
 */
export function EmailConfirmation({ dict }: { dict: Dictionary }) {
  const t = dict.potwierdzenie;
  const token = useSearchParams().get('token');
  const [stan, setStan] = useState<Stan>({ faza: 'sprawdzam' });
  const [ponowione, setPonowione] = useState(false);

  useEffect(() => {
    if (!token) {
      setStan({ faza: 'blad', powod: t.bladNiekompletny });
      return;
    }
    verifyEmail(token)
      .then(() => setStan({ faza: 'gotowe' }))
      .catch((przyczyna: unknown) =>
        setStan({
          faza: 'blad',
          powod: przyczyna instanceof Error ? przyczyna.message : t.bladOgolny,
        }),
      );
    // `t` nie zmienia się w trakcie życia strony — język jest wybrany adresem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (stan.faza === 'sprawdzam') {
    return (
      <p className="mono" style={{ marginTop: '24px', color: 'var(--muted)' }}>
        {t.sprawdzam}
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
          {t.gotoweTytul}
        </h1>
        <p style={{ color: 'var(--ink-2)', marginBottom: '18px' }}>
          {t.gotoweTresc}
        </p>
        <a className="btn btn-primary" href="https://panel.kelbroo.com">
          {t.doPanelu}
        </a>
      </div>
    );
  }

  return (
    <div className="split-card" style={{ marginTop: '24px', borderColor: 'var(--orange)' }}>
      <h1 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, marginBottom: '8px' }}>
        {t.nieudaneTytul}
      </h1>
      <p style={{ color: 'var(--ink-2)', marginBottom: '18px' }}>{stan.powod}</p>

      {/*
        Wysyłka nowego odnośnika wprost stąd. Klient trafił tu z wygasłym linkiem
        i odesłanie go do formularza logowania po nowy byłoby drogą naokoło.
      */}
      {ponowione ? (
        <p className="mono" style={{ fontSize: 'var(--fs-sm)', color: 'var(--teal)' }}>
          {t.ponowioneInfo}
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
          <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{t.etykietaPonow}</label>
          <input
            name="email"
            type="email"
            required
            placeholder={t.placeholderEmail}
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
            {t.wyslijPonownie}
          </button>
        </form>
      )}
    </div>
  );
}
