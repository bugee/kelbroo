'use client';

import { useState } from 'react';
import { isValidNip } from '@kelbroo/types';
import { RegistrationError, register, type Pole, type RegistrationInput } from '@/lib/api';

/** Minimalna długość hasła — ta sama, której pilnuje serwer. */
const MIN_HASLO = 8;

/**
 * Sprawdzenie po stronie przeglądarki.
 *
 * Nie zastępuje walidacji serwera, tylko oszczędza podróż tam i z powrotem
 * na rzeczach oczywistych. Reguły są celowo **te same** co w `RegisterDto` —
 * formularz, który przepuszcza coś, co serwer odrzuci, jest gorszy niż brak
 * sprawdzania, bo obiecuje poprawność.
 */
function sprawdz(dane: RegistrationInput): Partial<Record<Pole, string>> {
  const bledy: Partial<Record<Pole, string>> = {};

  if (dane.restaurantName.trim().length < 2) bledy.restaurantName = 'Podaj nazwę lokalu.';
  if (dane.ownerName.trim().length < 2) bledy.ownerName = 'Podaj imię i nazwisko.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dane.email.trim()))
    bledy.email = 'To nie wygląda na poprawny adres e-mail.';
  if (dane.password.length < MIN_HASLO)
    bledy.password = `Hasło musi mieć co najmniej ${MIN_HASLO} znaków.`;
  // Suma kontrolna, nie sama długość — literówka wyszłaby dopiero przy fakturze.
  if (!isValidNip(dane.nip)) bledy.nip = 'Sprawdź numer NIP — te cyfry się nie zgadzają.';

  return bledy;
}

/**
 * Formularz zakładania konta.
 *
 * Błędy pokazujemy **przy polach**, których dotyczą. Jeden komunikat na dole
 * formularza zmusza do zgadywania, co poprawić — a przy zakładaniu konta to
 * moment, w którym najłatwiej zrezygnować.
 */
export function RegistrationForm() {
  const [wysylanie, setWysylanie] = useState(false);
  const [bledy, setBledy] = useState<Partial<Record<Pole, string>>>({});
  const [blad, setBlad] = useState<string | null>(null);
  const [gotowe, setGotowe] = useState<{ nazwa: string; email: string } | null>(null);

  if (gotowe) {
    return (
      <div
        className="split-card"
        style={{ borderColor: 'var(--teal)', background: 'var(--teal-wash)' }}
      >
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, marginBottom: '8px' }}>
          Sprawdź skrzynkę
        </h2>
        {/*
          Konto dla „…" istnieje, ale panel wpuści dopiero po potwierdzeniu adresu.
          Mówimy to wprost, żeby nikt nie próbował się logować i nie odbił się
          o komunikat, którego nie umiałby powiązać z tym ekranem.
        */}
        <p style={{ color: 'var(--ink-2)', marginBottom: '12px' }}>
          Konto dla „{gotowe.nazwa}” jest założone. Wysłaliśmy wiadomość na{' '}
          <strong>{gotowe.email}</strong> — kliknij w odnośnik, żeby potwierdzić adres i wejść do
          panelu.
        </p>
        <p className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
          Wiadomość nie dotarła? Sprawdź spam albo napisz na kontakt@kelbroo.com.
        </p>
      </div>
    );
  }

  /**
   * `onSubmit`, a nie `action`.
   *
   * React 19 czyści formularz po wykonaniu akcji — przy nieudanej próbie klient
   * traciłby wszystko, co wpisał, i musiał zaczynać od nowa. Przy zakładaniu
   * konta to moment, w którym najłatwiej zrezygnować.
   */
  const wyslij = async (zdarzenie: React.FormEvent<HTMLFormElement>) => {
    zdarzenie.preventDefault();
    const formularz = new FormData(zdarzenie.currentTarget);

    const dane: RegistrationInput = {
      restaurantName: String(formularz.get('restaurantName') ?? ''),
      ownerName: String(formularz.get('ownerName') ?? ''),
      email: String(formularz.get('email') ?? ''),
      password: String(formularz.get('password') ?? ''),
      nip: String(formularz.get('nip') ?? ''),
    };

    const wlasne = sprawdz(dane);
    if (Object.keys(wlasne).length > 0) {
      setBledy(wlasne);
      setBlad(null);
      return;
    }

    setWysylanie(true);
    setBledy({});
    setBlad(null);
    try {
      const wynik = await register(dane);
      setGotowe({ nazwa: wynik.restaurantName, email: dane.email.trim() });
    } catch (przyczyna) {
      if (przyczyna instanceof RegistrationError) {
        setBledy(przyczyna.pola);
        // Gdy błąd dotyczy pól, komunikat nad przyciskiem tylko by je powtarzał.
        setBlad(Object.keys(przyczyna.pola).length > 0 ? null : przyczyna.message);
      } else {
        setBlad('Nie udało się założyć konta. Spróbuj ponownie.');
      }
    } finally {
      setWysylanie(false);
    }
  };

  return (
    <form
      onSubmit={(zdarzenie) => void wyslij(zdarzenie)}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      <Pole
        nazwa="restaurantName"
        label="Nazwa lokalu"
        autoComplete="organization"
        blad={bledy.restaurantName}
      />
      <Pole nazwa="ownerName" label="Imię i nazwisko" autoComplete="name" blad={bledy.ownerName} />
      <Pole
        nazwa="nip"
        label="NIP"
        inputMode="numeric"
        podpowiedz="Dziesięć cyfr. Usługa jest wyłącznie dla firm."
        blad={bledy.nip}
      />
      <Pole nazwa="email" label="E-mail" type="email" autoComplete="email" blad={bledy.email} />
      <Pole
        nazwa="password"
        label="Hasło"
        type="password"
        autoComplete="new-password"
        podpowiedz={`Co najmniej ${MIN_HASLO} znaków.`}
        blad={bledy.password}
      />

      {/*
        Zgody są dwie i obie wymagane — pole odznaczone ma zatrzymać formularz,
        a nie zapisać się jako brak zgody. Wersje dokumentów lecą razem z żądaniem.
        Tu zostaje `required` przeglądarki: to jedyne pola, przy których komunikat
        systemowy jest tak samo dobry jak własny.
      */}
      <Zgoda name="acceptTerms">
        Akceptuję <a href="/regulamin">regulamin</a> usługi kelbroo.
      </Zgoda>
      <Zgoda name="acceptPrivacy">
        Zapoznałem się z <a href="/prywatnosc">polityką prywatności</a>.
      </Zgoda>

      {blad && (
        <p
          role="alert"
          style={{
            color: 'var(--orange)',
            fontSize: 'var(--fs-sm)',
            background: 'var(--orange-wash)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
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
  nazwa,
  label,
  podpowiedz,
  blad,
  ...reszta
}: React.InputHTMLAttributes<HTMLInputElement> & {
  nazwa: string;
  label: string;
  podpowiedz?: string;
  blad?: string;
}) {
  const idBledu = `${nazwa}-blad`;

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{label}</span>
      <input
        name={nazwa}
        aria-invalid={blad ? true : undefined}
        aria-describedby={blad ? idBledu : undefined}
        {...reszta}
        style={{
          minHeight: '48px',
          padding: '0 14px',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${blad ? 'var(--orange)' : 'var(--line-strong)'}`,
          background: 'var(--surface)',
          color: 'var(--ink)',
          font: 'inherit',
        }}
      />
      {blad ? (
        <span id={idBledu} style={{ fontSize: 'var(--fs-xs)', color: 'var(--orange)' }}>
          {blad}
        </span>
      ) : (
        podpowiedz && (
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>{podpowiedz}</span>
        )
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
