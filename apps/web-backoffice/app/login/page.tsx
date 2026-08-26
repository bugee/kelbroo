'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, verifyCode } from '@/lib/api';

/** Krok, na którym stoi formularz. Hasło samo w sobie nie kończy logowania. */
type Krok = { etap: 'haslo' } | { etap: 'kod'; challengeId: string; email: string; minuty: number };

export default function LoginPage() {
  const router = useRouter();
  const [krok, setKrok] = useState<Krok>({ etap: 'haslo' });
  const [wysylanie, setWysylanie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  const podajHaslo = async (zdarzenie: React.FormEvent<HTMLFormElement>) => {
    zdarzenie.preventDefault();
    const dane = new FormData(zdarzenie.currentTarget);
    const email = String(dane.get('email') ?? '');
    setWysylanie(true);
    setBlad(null);
    try {
      const { challengeId, expiresInMinutes } = await login(
        email,
        String(dane.get('password') ?? ''),
      );
      setKrok({ etap: 'kod', challengeId, email, minuty: expiresInMinutes });
    } catch (przyczyna) {
      setBlad(przyczyna instanceof Error ? przyczyna.message : 'Nie udało się zalogować.');
    } finally {
      setWysylanie(false);
    }
  };

  const podajKod = async (zdarzenie: React.FormEvent<HTMLFormElement>) => {
    zdarzenie.preventDefault();
    if (krok.etap !== 'kod') return;
    const dane = new FormData(zdarzenie.currentTarget);
    setWysylanie(true);
    setBlad(null);
    try {
      await verifyCode(krok.challengeId, String(dane.get('code') ?? '').trim());
      router.replace('/');
    } catch (przyczyna) {
      setBlad(przyczyna instanceof Error ? przyczyna.message : 'Nie udało się zalogować.');
    } finally {
      setWysylanie(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form
        key={krok.etap}
        onSubmit={(zdarzenie) =>
          void (krok.etap === 'haslo' ? podajHaslo(zdarzenie) : podajKod(zdarzenie))
        }
        className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-6"
      >
        <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--teal)]">
          kelbroo
        </p>
        {/* Nazwa ekranu ma odróżniać go od panelu restauracji na pierwszy rzut oka —
            te same barwy, zupełnie inne uprawnienia. */}
        <p className="mono mb-6 text-sm text-[var(--muted)]">Zaplecze platformy</p>

        {krok.etap === 'haslo' ? <PolaHasla /> : <PoleKodu krok={krok} />}

        {blad && (
          <p role="alert" className="mb-4 text-sm text-[var(--orange)]">
            {blad}
          </p>
        )}

        <button
          type="submit"
          disabled={wysylanie}
          className="min-h-12 w-full rounded-[var(--radius-control)] bg-[var(--teal)] font-semibold text-white disabled:opacity-50"
        >
          {wysylanie ? 'Sprawdzam…' : krok.etap === 'haslo' ? 'Dalej' : 'Zaloguj'}
        </button>

        {krok.etap === 'kod' && (
          <button
            type="button"
            onClick={() => {
              setKrok({ etap: 'haslo' });
              setBlad(null);
            }}
            className="mt-3 min-h-11 w-full text-sm text-[var(--muted)] underline"
          >
            Zacznij od nowa
          </button>
        )}
      </form>
    </main>
  );
}

function PolaHasla() {
  return (
    <>
      <label className="mb-4 flex flex-col gap-1.5">
        <span className="text-sm font-semibold">E-mail</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="min-h-11 rounded-[var(--radius-control)] border border-[var(--line-strong)] bg-[var(--surface)] px-3"
        />
      </label>

      <label className="mb-6 flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Hasło</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="min-h-11 rounded-[var(--radius-control)] border border-[var(--line-strong)] bg-[var(--surface)] px-3"
        />
      </label>
    </>
  );
}

/**
 * Sześć cyfr ze skrzynki.
 *
 * `inputMode="numeric"` wywołuje klawiaturę cyfr na tablecie, a `autoComplete="one-time-code"`
 * pozwala telefonowi podpowiedzieć kod z powiadomienia — przy sześciu cyfrach
 * przepisywanych z drugiego urządzenia to różnica między sekundą a pomyłką.
 */
function PoleKodu({ krok }: { krok: { email: string; minuty: number } }) {
  const pole = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pole.current?.focus();
  }, []);

  return (
    <>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Wysłaliśmy sześciocyfrowy kod na <strong className="text-[var(--ink)]">{krok.email}</strong>
        . Jest ważny {krok.minuty} minut.
      </p>

      <label className="mb-6 flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Kod z e-maila</span>
        <input
          ref={pole}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          className="mono min-h-11 rounded-[var(--radius-control)] border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-center text-2xl tracking-[0.4em]"
        />
      </label>
    </>
  );
}
