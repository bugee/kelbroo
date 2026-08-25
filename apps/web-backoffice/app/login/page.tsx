'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [wysylanie, setWysylanie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  const zaloguj = async (zdarzenie: React.FormEvent<HTMLFormElement>) => {
    zdarzenie.preventDefault();
    const dane = new FormData(zdarzenie.currentTarget);
    setWysylanie(true);
    setBlad(null);
    try {
      await login(String(dane.get('email') ?? ''), String(dane.get('password') ?? ''));
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
        onSubmit={(zdarzenie) => void zaloguj(zdarzenie)}
        className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-6"
      >
        <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--teal)]">
          kelbroo
        </p>
        {/* Nazwa ekranu ma odróżniać go od panelu restauracji na pierwszy rzut oka —
            te same barwy, zupełnie inne uprawnienia. */}
        <p className="mono mb-6 text-sm text-[var(--muted)]">Zaplecze platformy</p>

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
          {wysylanie ? 'Loguję…' : 'Zaloguj'}
        </button>
      </form>
    </main>
  );
}
