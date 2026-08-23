'use client';

import { useCallback, useEffect, useState } from 'react';
import { StaffShell } from '@/components/StaffShell';
import {
  createStaffMember,
  fetchStaff,
  resetStaffPassword,
  setStaffActive,
  updateStaffMember,
  type StaffMember,
  type StaffRole,
} from '@/lib/api';

const MIN_PASSWORD = 8;

const ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Właściciel',
  manager: 'Manager',
  waiter: 'Kelner',
  kitchen: 'Kuchnia',
};

/** Kolejność od najwyższej roli — ta sama hierarchia co po stronie API. */
const ROLES: StaffRole[] = ['owner', 'manager', 'waiter', 'kitchen'];

export default function StaffPage() {
  return <StaffShell>{(staff) => <Team myRole={staff.role} />}</StaffShell>;
}

function Team({ myRole }: { myRole: StaffRole }) {
  const [members, setMembers] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMembers(await fetchStaff());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się wczytać zespołu.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(message);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać.');
    }
  };

  if (error && !members) return <p className="text-[var(--orange)]">{error}</p>;
  if (!members) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  return (
    <div className="max-w-3xl">
      {error && <p className="mb-3 text-[var(--orange)]">{error}</p>}
      {notice && (
        <p className="mb-3 rounded-[var(--radius-control)] bg-[var(--teal-wash)] p-3 text-sm">
          {notice}
        </p>
      )}

      <AddMember myRole={myRole} onCreated={run} />

      <ul className="mt-6 flex flex-col gap-2">
        {members.map((member) => (
          <MemberRow key={member.id} member={member} myRole={myRole} onAction={run} />
        ))}
      </ul>

      <p className="mt-6 text-sm text-[var(--muted)]">
        Każde konto zakładane tutaj dostaje hasło tymczasowe — pracownik zmieni je przy pierwszym
        logowaniu. Swoje własne hasło zmieniasz na ekranie dostępnym pod imieniem w nagłówku.
      </p>
    </div>
  );
}

function AddMember({
  myRole,
  onCreated,
}: {
  myRole: StaffRole;
  onCreated: (action: () => Promise<unknown>, message: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('waiter');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Nie da się nadać roli wyższej niż własna — API i tak by to odrzuciło.
  const grantable = ROLES.filter((candidate) => ROLES.indexOf(candidate) >= ROLES.indexOf(myRole));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    await onCreated(
      () => createStaffMember({ email, name, role, password }),
      `Konto ${email} zostało założone.`,
    );
    setBusy(false);
    setOpen(false);
    setEmail('');
    setName('');
    setPassword('');
    setRole('waiter');
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-12 rounded-[var(--radius-control)] bg-[var(--teal)] px-5 font-semibold text-white"
      >
        Dodaj pracownika
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
    >
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">Nowy pracownik</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Imię i nazwisko" value={name} onChange={setName} />
        <Field label="E-mail" value={email} onChange={setEmail} type="email" />
        <label className="block text-sm font-semibold">
          Rola
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as StaffRole)}
            className="mono mt-1 min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3"
          >
            {grantable.map((candidate) => (
              <option key={candidate} value={candidate}>
                {ROLE_LABEL[candidate]}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Hasło tymczasowe"
          value={password}
          onChange={setPassword}
          hint={`Co najmniej ${MIN_PASSWORD} znaków`}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={busy || password.length < MIN_PASSWORD}
          className="min-h-12 rounded-[var(--radius-control)] bg-[var(--teal)] px-5 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Zakładam…' : 'Załóż konto'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-12 px-4 text-sm text-[var(--muted)] underline"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}

function MemberRow({
  member,
  myRole,
  onAction,
}: {
  member: StaffMember;
  myRole: StaffRole;
  onAction: (action: () => Promise<unknown>, message: string) => Promise<void>;
}) {
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const grantable = ROLES.filter((candidate) => ROLES.indexOf(candidate) >= ROLES.indexOf(myRole));

  return (
    <li
      className={`rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 ${
        member.isActive ? '' : 'opacity-60'
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {member.name}
            {member.isSelf && <span className="ml-2 text-sm text-[var(--muted)]">(to Ty)</span>}
          </p>
          <p className="mono truncate text-sm text-[var(--muted)]">{member.email}</p>
        </div>

        <span className="mono rounded-[var(--radius-control)] bg-[var(--teal-wash)] px-3 py-1 text-sm text-[var(--teal)]">
          {ROLE_LABEL[member.role]}
        </span>

        {!member.isActive && (
          <span className="mono rounded-[var(--radius-control)] bg-[var(--orange-wash)] px-3 py-1 text-sm text-[var(--orange)]">
            nieaktywne
          </span>
        )}
        {member.mustChangePassword && member.isActive && (
          <span className="mono text-sm text-[var(--muted)]">hasło tymczasowe</span>
        )}
      </div>

      {member.canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
          <select
            value={member.role}
            onChange={(event) =>
              void onAction(
                () => updateStaffMember(member.id, { role: event.target.value as StaffRole }),
                `Rola konta ${member.email} została zmieniona.`,
              )
            }
            className="mono min-h-11 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
          >
            {grantable.map((candidate) => (
              <option key={candidate} value={candidate}>
                {ROLE_LABEL[candidate]}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() =>
              void onAction(
                () => setStaffActive(member.id, !member.isActive),
                member.isActive
                  ? `Konto ${member.email} zostało wyłączone.`
                  : `Konto ${member.email} zostało włączone.`,
              )
            }
            className="min-h-11 rounded-[var(--radius-control)] border border-[var(--line)] px-4 text-sm font-semibold"
          >
            {member.isActive ? 'Wyłącz' : 'Włącz'}
          </button>

          {resetting ? (
            <span className="flex items-center gap-2">
              <input
                type="text"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="nowe hasło tymczasowe"
                className="mono min-h-11 rounded-[var(--radius-control)] border border-[var(--line)] px-3 text-sm"
              />
              <button
                type="button"
                disabled={newPassword.length < MIN_PASSWORD}
                onClick={() =>
                  void onAction(async () => {
                    await resetStaffPassword(member.id, newPassword);
                    setResetting(false);
                    setNewPassword('');
                  }, `Hasło konta ${member.email} zostało zmienione na tymczasowe.`)
                }
                className="min-h-11 rounded-[var(--radius-control)] bg-[var(--teal)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Zapisz
              </button>
              <button
                type="button"
                onClick={() => setResetting(false)}
                className="min-h-11 px-3 text-sm text-[var(--muted)] underline"
              >
                Anuluj
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setResetting(true)}
              className="min-h-11 rounded-[var(--radius-control)] border border-[var(--line)] px-4 text-sm font-semibold"
            >
              Zresetuj hasło
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        type={type}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-4"
      />
      {hint && <span className="mt-1 block font-normal text-[var(--muted)]">{hint}</span>}
    </label>
  );
}
