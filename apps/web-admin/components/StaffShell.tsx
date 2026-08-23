'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@kelbroo/ui/theme';
import { useLiveData } from '@/components/useLiveData';
import { clearSession, fetchBadges, me, readAccess, type Staff, type StaffRole } from '@/lib/api';

type NavItem = { href: string; label: string; roles: StaffRole[] };

/**
 * Praca na zmianie: to, co kelner i kuchnia klikają dziesiątki razy dziennie.
 *
 * „Zamów" nie ma tu własnej pozycji: zamawianie zaczyna się od stolika, a stoliki
 * są na Sali. Osobne wejście kazało wybrać stolik drugi raz, z listy bez rachunków
 * i bez gości — czyli bez tego, po czym kelner ten stolik rozpoznaje.
 */
const NAV: NavItem[] = [
  { href: '/queue', label: 'Powiadomienia', roles: ['owner', 'manager', 'waiter'] },
  { href: '/kds', label: 'Kuchnia', roles: ['owner', 'manager', 'waiter', 'kitchen'] },
  { href: '/tables', label: 'Sala', roles: ['owner', 'manager', 'waiter'] },
];

/**
 * Konfiguracja: rzeczy ustawiane raz i zaglądane rzadko. Schowane pod jednym
 * przyciskiem, żeby nie konkurowały z ekranami serwisu.
 *
 * „Zmień hasło" widzi każda rola — kuchnia ma tu wyłącznie tę pozycję.
 */
const SETTINGS_NAV: NavItem[] = [
  { href: '/menu', label: 'Menu', roles: ['owner', 'manager'] },
  { href: '/qr', label: 'Stoliki i QR', roles: ['owner', 'manager'] },
  { href: '/staff', label: 'Zespół', roles: ['owner', 'manager'] },
  { href: '/password', label: 'Zmień hasło', roles: ['owner', 'manager', 'waiter', 'kitchen'] },
  { href: '/settings', label: 'Lokale i abonament', roles: ['owner', 'manager'] },
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
  const settings = SETTINGS_NAV.filter((item) => item.roles.includes(staff.role));
  return (
    <Shell staff={staff} visible={visible} settings={settings}>
      {children}
    </Shell>
  );
}

function Shell({
  staff,
  visible,
  settings,
  children,
}: {
  staff: Staff;
  visible: NavItem[];
  settings: NavItem[];
  children: (staff: Staff) => React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Liczniki żyją w powłoce, więc kelner widzi pracę czekającą także wtedy,
  // gdy stoi na zupełnie innym ekranie.
  const loadBadges = useCallback(() => fetchBadges(), []);
  const { data: badges } = useLiveData(loadBadges);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2 print:hidden">
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
                <Badge count={badges?.[item.href]} />
              </Link>
            ))}
          </nav>

          <span className="text-sm text-[var(--muted)]">
            {staff.name} · {staff.role}
          </span>

          {settings.length > 0 && <SettingsMenu items={settings} pathname={pathname} />}

          {/* Kuchnia często pracuje przy słabym świetle — wybór palety
              zostaje na urządzeniu, nie na koncie pracownika. */}
          <ThemeToggle />
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

/**
 * Liczba pracy czekającej przy pozycji menu.
 *
 * Sama liczba, nie kropka — kelner ma wiedzieć, czy czeka jedno zamówienie,
 * czy siedem. Zero nie jest informacją, więc serwer go nie zwraca i nic tu nie rysujemy.
 */
function Badge({ count }: { count?: number }) {
  if (!count) return null;

  return (
    <span
      aria-label={`${count} do obsługi`}
      className="mono ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--orange)] px-1.5 py-0.5 text-xs font-bold text-white"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function SettingsMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const here = items.some((item) => item.href === pathname);

  // Panel bywa obsługiwany na tablecie jedną ręką — menu zamyka się samo po
  // kliknięciu obok, po Escape i po przejściu na wybrany ekran.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`mono min-h-11 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-semibold ${
          here || open ? 'bg-[var(--teal-wash)] text-[var(--teal)]' : 'text-[var(--muted)]'
        }`}
      >
        Ustawienia
        <span aria-hidden="true" className="ml-2">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 flex min-w-56 flex-col rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-lg"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`mono min-h-11 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-semibold ${
                pathname === item.href
                  ? 'bg-[var(--teal-wash)] text-[var(--teal)]'
                  : 'text-[var(--muted)]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
