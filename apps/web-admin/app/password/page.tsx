'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StaffShell } from '@/components/StaffShell';
import { changePassword, readMustChangePassword, updateProfile, type Staff } from '@/lib/api';

export default function PasswordPage() {
  return <StaffShell>{(staff) => <ChangePassword staff={staff} />}</StaffShell>;
}

const MIN_LENGTH = 8;

function ChangePassword({ staff }: { staff: Staff }) {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [required, setRequired] = useState(false);

  useEffect(() => {
    setRequired(readMustChangePassword());
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    // Zgodność powtórzenia sprawdzamy tutaj — API nie zna drugiego pola.
    if (next !== repeat) {
      setError('Nowe hasło i powtórzenie różnią się.');
      return;
    }
    if (next.length < MIN_LENGTH) {
      setError(`Nowe hasło musi mieć co najmniej ${MIN_LENGTH} znaków.`);
      return;
    }

    setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true);
      setCurrent('');
      setNext('');
      setRepeat('');
      if (required) {
        setRequired(false);
        router.replace(staff.role === 'kitchen' ? '/kds' : '/queue');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zmienić hasła.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex max-w-md flex-col gap-4">
      <ProfileCard staff={staff} />
      <form
        onSubmit={submit}
        className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-6"
      >
        <h1 className="font-[family-name:var(--font-display)] text-xl font-bold">Zmiana hasła</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {staff.name} · {staff.role}
        </p>

        {required && (
          <p className="mt-4 rounded-[var(--radius-control)] bg-[var(--orange-wash)] p-3 text-sm">
            To konto ma ustawione hasło tymczasowe. Zmień je, zanim zaczniesz pracę.
          </p>
        )}

        <Field
          label="Aktualne hasło"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <Field label="Nowe hasło" value={next} onChange={setNext} autoComplete="new-password" />
        <Field
          label="Powtórz nowe hasło"
          value={repeat}
          onChange={setRepeat}
          autoComplete="new-password"
        />

        <p className="mt-2 text-sm text-[var(--muted)]">Co najmniej {MIN_LENGTH} znaków.</p>

        {error && <p className="mt-4 text-sm text-[var(--orange)]">{error}</p>}
        {done && !required && (
          <p className="mono mt-4 text-sm text-[var(--teal)]">Hasło zostało zmienione.</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 min-h-12 w-full rounded-[var(--radius-control)] bg-[var(--teal)] font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Zapisuję…' : 'Zmień hasło'}
        </button>

        <p className="mt-4 text-sm text-[var(--muted)]">
          Zmiana nie wylogowuje pozostałych urządzeń — sesje otwarte na innych tabletach zostają
          ważne do wygaśnięcia tokenu.
        </p>
      </form>
    </div>
  );
}

/**
 * Własne dane konta. Lista zespołu celowo nie pozwala zmienić samego siebie,
 * więc bez tego formularza zmiana własnego adresu wymagałaby wejścia do bazy.
 */
function ProfileCard({ staff }: { staff: Staff }) {
  const [name, setName] = useState(staff.name);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await updateProfile({ name, ...(email ? { email } : {}) });
      setSaved(true);
      setEmail('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać danych.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-6"
    >
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Dane konta</h2>

      <label className="mt-4 block text-sm font-semibold">
        Imię i nazwisko
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-4"
        />
      </label>

      <label className="mt-4 block text-sm font-semibold">
        Nowy adres e-mail
        <input
          type="email"
          value={email}
          placeholder="zostaw puste, żeby nie zmieniać"
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-4"
        />
        <span className="mt-1 block font-normal text-[var(--muted)]">
          Od następnego logowania będziesz się logować tym adresem.
        </span>
      </label>

      {error && <p className="mt-4 text-sm text-[var(--orange)]">{error}</p>}
      {saved && (
        <p className="mono mt-4 text-sm text-[var(--teal)]">
          Zapisano. W nagłówku zobaczysz zmianę po ponownym zalogowaniu.
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 min-h-12 rounded-[var(--radius-control)] border border-[var(--line)] px-5 font-semibold disabled:opacity-50"
      >
        {busy ? 'Zapisuję…' : 'Zapisz dane'}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="mt-4 block text-sm font-semibold">
      {label}
      <input
        type="password"
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-4"
      />
    </label>
  );
}
