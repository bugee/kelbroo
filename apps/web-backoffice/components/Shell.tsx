'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearToken, me, readToken, type Admin } from '@/lib/api';

/** Powłoka zaplecza: sprawdza sesję i trzyma nagłówek. */
export function Shell({ children }: { children: (admin: Admin) => React.ReactNode }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);

  useEffect(() => {
    if (!readToken()) {
      router.replace('/login');
      return;
    }
    me()
      .then(setAdmin)
      .catch(() => {
        clearToken();
        router.replace('/login');
      });
  }, [router]);

  if (!admin) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <span className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--teal)]">
            kelbroo
          </span>
          <span className="mono text-sm text-[var(--muted)]">zaplecze</span>
          <span className="ml-auto text-sm text-[var(--muted)]">{admin.name}</span>
          <button
            type="button"
            onClick={() => {
              clearToken();
              router.replace('/login');
            }}
            className="min-h-11 px-3 text-sm text-[var(--muted)] underline"
          >
            Wyloguj
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">{children(admin)}</main>
    </div>
  );
}
