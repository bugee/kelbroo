'use client';

import { useEffect, useState } from 'react';
import { localePath, type Dictionary, type Locale } from '@kelbroo/i18n';
import { sendContact, type ContactInput } from '@/lib/api';

const POLE: React.CSSProperties = {
  minHeight: '48px',
  padding: '0 14px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--line-strong)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  font: 'inherit',
};

/**
 * Formularz kontaktowy.
 *
 * Jeden formularz na dwie sprawy, bo dla piszącego to jedna sprawa: „chcę
 * porozmawiać". Rozróżnienie potrzebne jest nam — prezentacja idzie do
 * kalendarza, pytanie do skrzynki — więc pytamy o nie jednym przełącznikiem
 * zamiast dwoma osobnymi formularzami na dwóch podstronach.
 *
 * Wejść jest trzy i każde niesie inną intencję: „Umów prezentację" z sekcji
 * końcowej, „Porozmawiajmy" z planu Enterprise i „Kontakt" ze stopki. Cel
 * ustawia się sam z kotwicy, żeby nikt nie musiał go wybierać drugi raz.
 */
export function ContactForm({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const t = dict.formularz;
  const [cel, setCel] = useState<ContactInput['purpose']>('pytanie');
  const [wysylanie, setWysylanie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [gotowe, setGotowe] = useState(false);

  useEffect(() => {
    // `#prezentacja` prowadzi do tej samej sekcji, ale z gotowym wyborem.
    const ustaw = () => {
      if (window.location.hash === '#prezentacja') setCel('prezentacja');
    };
    ustaw();
    window.addEventListener('hashchange', ustaw);
    return () => window.removeEventListener('hashchange', ustaw);
  }, []);

  const wyslij = async (zdarzenie: React.FormEvent<HTMLFormElement>) => {
    zdarzenie.preventDefault();
    const dane = new FormData(zdarzenie.currentTarget);
    setWysylanie(true);
    setBlad(null);
    try {
      await sendContact({
        purpose: cel,
        name: String(dane.get('name') ?? ''),
        company: String(dane.get('company') ?? '') || undefined,
        email: String(dane.get('email') ?? ''),
        phone: String(dane.get('phone') ?? '') || undefined,
        preferredTime: cel === 'prezentacja' ? String(dane.get('preferredTime') ?? '') : undefined,
        message: String(dane.get('message') ?? ''),
        website: String(dane.get('website') ?? ''),
      });
      setGotowe(true);
    } catch (przyczyna) {
      setBlad(przyczyna instanceof Error ? przyczyna.message : t.bladOgolny);
    } finally {
      setWysylanie(false);
    }
  };

  if (gotowe) {
    return (
      <div className="split-card" role="status">
        <h3 style={{ marginTop: 0 }}>{t.wyslaneTytul}</h3>
        <p>{t.wyslaneTresc}</p>
      </div>
    );
  }

  return (
    <form
      className="split-card"
      onSubmit={(zdarzenie) => void wyslij(zdarzenie)}
      style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
    >
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: '8px' }}>
          {t.sprawa}
        </legend>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(
            [
              ['pytanie', t.celPytanie],
              ['prezentacja', t.celPrezentacja],
            ] as const
          ).map(([wartosc, etykieta]) => (
            <button
              key={wartosc}
              type="button"
              aria-pressed={cel === wartosc}
              onClick={() => setCel(wartosc)}
              className={cel === wartosc ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
            >
              {etykieta}
            </button>
          ))}
        </div>
      </fieldset>

      <Pole nazwa="name" label={t.imie} autoComplete="name" required />
      <Pole nazwa="company" label={t.lokal} autoComplete="organization" />
      <Pole nazwa="email" label={t.email} type="email" autoComplete="email" required />
      <Pole
        nazwa="phone"
        label={t.telefon}
        type="tel"
        autoComplete="tel"
        podpowiedz={t.nieobowiazkowo}
      />

      {cel === 'prezentacja' && (
        <Pole
          nazwa="preferredTime"
          label={t.kiedy}
          podpowiedz={t.kiedyPodpowiedz}
        />
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{t.wiadomosc}</span>
        <textarea
          name="message"
          required
          minLength={10}
          rows={5}
          placeholder={
            cel === 'prezentacja' ? t.placeholderPrezentacja : t.placeholderPytanie
          }
          style={{ ...POLE, minHeight: '120px', padding: '12px 14px', resize: 'vertical' }}
        />
      </label>

      {/* Pułapka na roboty: niewidoczna dla człowieka i wyjęta z kolejności
          tabulacji, więc wypełnia ją wyłącznie automat. Tańsza od CAPTCHA
          i nie kosztuje użytkownika ani jednego kliknięcia. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
        <label>
          {t.pulapka}
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {blad && (
        <p role="alert" style={{ color: 'var(--orange)', fontSize: 'var(--fs-sm)', margin: 0 }}>
          {blad}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={wysylanie}>
        {wysylanie ? t.wysylam : cel === 'prezentacja' ? t.umowPrezentacje : t.wyslijWiadomosc}
      </button>

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', margin: 0 }}>
        {t.zgodaAdres}{' '}
        <a href={localePath(locale, '/prywatnosc')}>{t.politykaLink}</a>.
      </p>
    </form>
  );
}

function Pole({
  nazwa,
  label,
  podpowiedz,
  ...reszta
}: React.InputHTMLAttributes<HTMLInputElement> & {
  nazwa: string;
  label: string;
  podpowiedz?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{label}</span>
      <input name={nazwa} {...reszta} style={POLE} />
      {podpowiedz && (
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>{podpowiedz}</span>
      )}
    </label>
  );
}
