'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { clearSession, me, readAccess, type Staff, type StaffRole } from '@/lib/api';

const NAV: { href: string; label: string; roles: StaffRole[] }[] = [
  { href: '/queue', label: 'Do potwierdzenia', roles: ['owner', 'manager', 'waiter'] },
  { href: '/kds', label: 'Kuchnia', roles: ['owner', 'manager', 'waiter', 'kitchen'] },
  { href: '/tables', label: 'Sala', roles: ['owner', 'manager', 'waiter'] },
];

export function StaffShell({ children }: { children: (staff: Staff) => React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [staff, setStaff] = useState<Staff | null>(null);

  useEffect(() => {
    if (!readAccess()) {
      router.replace('/login');
      return;
    }
    me()
      .then(setStaff)
      .catch(() => {
        clearSession();
        router.replace('/login');
      });
  }, [router]);

  if (!staff) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>
      </main>
    );
  }

  const visible = NAV.filter((item) => item.roles.includes(staff.role));

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <span className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--teal)]">
            kelbroo
          </span>

          <nav className="flex flex-1 gap-1">
            {visible.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`mono min-h-11 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-semibold ${
                  pathname === item.href
                    ? 'bg-[var(--teal-wash)] text-[var(--teal)]'
                    : 'text-[var(--muted)]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <span className="text-sm text-[var(--muted)]">
            {staff.name} · {staff.role}
          </span>
          <button
            type="button"
            onClick={() => {
              clearSession();
              router.replace('/login');
            }}
            className="min-h-11 px-3 text-sm text-[var(--muted)] underline"
          >
            Wyloguj
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">{children(staff)}</main>
    </div>
  );
}
