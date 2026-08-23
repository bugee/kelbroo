'use client';

import { useState } from 'react';
import { register } from '@/lib/api';

/**
 * Formularz zakładania konta.
 *
 * Rejestracja jest po stronie serwera **zamknięta** do czasu, aż będą regulamin
 * i polityka prywatności — formularz dostanie wtedy jasną odmowę i ją pokaże.
 * Nie duplikujemy tego przełącznika tutaj: jedno miejsce decyzji, po stronie,
 * która ją egzekwuje.
 */
export function RegistrationForm() {
  const [wysylanie, setWysylanie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [gotowe, setGotowe] = useState<{ nazwa: string; koniecProby: string } | null>(null);

  if (gotowe) {
    return (
      <div
        className="split-card"
        style={{ borderColor: 'var(--teal)', background: 'var(--teal-wash)' }}
      >
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, marginBottom: '8px' }}>
          Konto dla „{gotowe.nazwa}” jest gotowe
        </h2>
        <p style={{ color: 'var(--ink-2)', marginBottom: '18px' }}>
          Okres próbny trwa do {gotowe.koniecProby}. Zaloguj się i dodaj pierwsze pozycje karty.
        </p>
        <a className="btn btn-primary" href="https://panel.kelbroo.com">
          Przejdź do panelu
        </a>
      </div>
    );
  }

  const wyslij = async (formularz: FormData) => {
    setWysylanie(true);
    setBlad(null);
    try {
      const wynik = await register({
        restaurantName: String(formularz.get('restaurantName') ?? ''),
        ownerName: String(formularz.get('ownerName') ?? ''),
        email: String(formularz.get('email') ?? ''),
        password: String(formularz.get('password') ?? ''),
      });
      setGotowe({
        nazwa: wynik.restaurantName,
        koniecProby: new Date(wynik.trialEndsAt).toLocaleDateString('pl-PL'),
      });
    } catch (przyczyna) {
      setBlad(przyczyna instanceof Error ? przyczyna.message : 'Nie udało się założyć konta.');
    } finally {
      setWysylanie(false);
    }
  };

  return (
    <form action={wyslij} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Pole name="restaurantName" label="Nazwa lokalu" autoComplete="organization" required />
      <Pole name="ownerName" label="Imię i nazwisko" autoComplete="name" required />
      <Pole name="email" label="E-mail" type="email" autoComplete="email" required />
      <Pole
        name="password"
        label="Hasło"
        type="password"
        autoComplete="new-password"
        minLength={8}
        podpowiedz="Co najmniej 8 znaków."
        required
      />

      {/*
        Zgody są dwie i obie wymagane — pole odznaczone ma zatrzymać formularz,
        a nie zapisać się jako brak zgody. Wersje dokumentów lecą razem z żądaniem.
      */}
      <Zgoda name="acceptTerms">
        Akceptuję <a href="/regulamin">regulamin</a> usługi kelbroo.
      </Zgoda>
      <Zgoda name="acceptPrivacy">
        Zapoznałem się z <a href="/prywatnosc">polityką prywatności</a>.
      </Zgoda>

      {blad && (
        <p role="alert" style={{ color: 'var(--orange)', fontSize: 'var(--fs-sm)' }}>
          {blad}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={wysylanie}>
        {wysylanie ? 'Zakładam konto…' : 'Zacznij 14 dni za darmo'}
      </button>
    </form>
  );
}

function Pole({
  name,
  label,
  podpowiedz,
  ...reszta
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  podpowiedz?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{label}</span>
      <input
        name={name}
        {...reszta}
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
      {podpowiedz && (
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>{podpowiedz}</span>
      )}
    </label>
  );
}

function Zgoda({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <label
      style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: 'var(--fs-sm)' }}
    >
      <input type="checkbox" name={name} required style={{ marginTop: '4px' }} />
      <span>{children}</span>
    </label>
  );
}
