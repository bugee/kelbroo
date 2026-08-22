'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@kelbroo/ui/theme';
import { login } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const staff = await login(email, password);
      // Kuchnia nie ma po co oglądać kolejki potwierdzeń ani rachunków.
      router.replace(staff.role === 'kitchen' ? '/kds' : '/queue');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Logowanie nie powiodło się.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl text-[var(--teal)]">kelbroo</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Panel obsługi</p>
          </div>
          <ThemeToggle />
        </div>

        <label className="mt-6 block text-sm font-semibold">
          E-mail
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-4"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold">
          Hasło
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-4"
          />
        </label>

        {error && <p className="mt-4 text-sm text-[var(--orange)]">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 min-h-12 w-full rounded-[var(--radius-control)] bg-[var(--teal)] font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Loguję…' : 'Zaloguj'}
        </button>
      </form>
    </main>
  );
}
