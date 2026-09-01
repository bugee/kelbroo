'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@kelbroo/ui/theme';
import { useLiveData } from '@/components/useLiveData';
import { SoundToggle } from '@/components/SoundToggle';
import { zagrajSygnal } from '@/lib/sound';
import {
  clearSession,
  fetchBadges,
  fetchSubscription,
  me,
  readAccess,
  type Staff,
  type StaffRole,
  type SubscriptionState,
} from '@/lib/api';

type NavItem = {
  href: string;
  label: string;
  roles: StaffRole[];
  /**
   * Pozycja zależna od funkcji w planie. Ukrycie jest wygodą, nie
   * zabezpieczeniem — bramka stoi po stronie serwera.
   */
  feature?: 'reviews';
};

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
  { href: '/raporty', label: 'Sprzedaż', roles: ['owner', 'manager'] },
  { href: '/opinie', label: 'Opinie gości', roles: ['owner', 'manager'], feature: 'reviews' },
  { href: '/staff', label: 'Zespół', roles: ['owner', 'manager'] },
  { href: '/password', label: 'Zmień hasło', roles: ['owner', 'manager', 'waiter', 'kitchen'] },
  { href: '/settings', label: 'Lokal', roles: ['owner', 'manager'] },
  // Abonament to zobowiązanie firmy, nie ustawienie lokalu — stąd osobna
  // pozycja i wyłącznie dla właściciela.
  { href: '/abonament', label: 'Abonament', roles: ['owner'] },
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
  // Filtr po roli tutaj, po funkcjach planu niżej — stan abonamentu mieszka
  // w powłoce, bo pasek o wygaśnięciu ma być widoczny z każdego ekranu.
  const settings = SETTINGS_NAV.filter((item) => item.roles.includes(staff.role));
  return (
    <Shell staff={staff} onStaffChange={setStaff} visible={visible} settings={settings}>
      {children}
    </Shell>
  );
}

function Shell({
  staff,
  onStaffChange,
  visible,
  settings,
  children,
}: {
  staff: Staff;
  /** Przełącznik dźwięku zmienia konto, więc powłoka musi o tym wiedzieć. */
  onStaffChange: (staff: Staff) => void;
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

  /**
   * Sygnał dźwiękowy przy nowej pracy — **liczony w powłoce, nie na ekranach**.
   *
   * Dzięki temu kelner stojący na Sali usłyszy zamówienie czekające w
   * Powiadomieniach, a kuchnia usłyszy je niezależnie od tego, co ma otwarte.
   * Liczniki i tak żyją tutaj, więc źródłem sygnału jest przyrost licznika,
   * a nie osobne nasłuchiwanie na każdym ekranie z osobna.
   *
   * Gramy **wyłącznie przy wzroście**: spadek znaczy, że ktoś właśnie odebrał
   * pracę, a to nie jest wezwanie. Pierwszy odczyt po wejściu do panelu też
   * milczy — inaczej każde otwarcie ekranu z pięcioma zamówieniami w kolejce
   * zaczynałoby się od dzwonka.
   */
  const poprzednieLiczniki = useRef<Record<string, number> | null>(null);

  useEffect(() => {
    if (!badges) return;
    const poprzednie = poprzednieLiczniki.current;
    poprzednieLiczniki.current = badges;

    if (!poprzednie || !staff?.soundEnabled) return;

    const przybylo = ['/queue', '/kds'].some(
      (klucz) => (badges[klucz] ?? 0) > (poprzednie[klucz] ?? 0),
    );
    if (przybylo) zagrajSygnal();
  }, [badges, staff?.soundEnabled]);

  // Stan abonamentu też mieszka w powłoce: ostrzeżenie ma być widoczne z każdego
  // ekranu, a nie dopiero wtedy, gdy kelner stuknie w „Złóż zamówienie".
  const loadSubscription = useCallback(() => fetchSubscription(), []);
  const { data: abonament } = useLiveData(loadSubscription, 300_000);

  // Pozycje zależne od planu pokazujemy dopiero, gdy znamy plan. Menu, w którym
  // coś migocze i znika, czyta się jak usterka; pojawienie się chwilę później
  // nie przeszkadza nikomu.
  const widoczneUstawienia = settings.filter(
    (item) => !item.feature || abonament?.reviewsEnabled === true,
  );

  const wyloguj = () => {
    clearSession();
    router.replace('/login');
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2 print:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-2 sm:gap-3">
          <span className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--teal)]">
            kelbroo
          </span>

          {/*
            Nawigacja główna w nagłówku **tylko od tabletu w górę**. Na telefonie
            trzy pozycje z licznikami nie mieszczą się obok logo i przełączników,
            więc pasek trzeba było przewijać w bok — a przewijanie w poziomie
            w aplikacji, którą obsługuje się jedną ręką w biegu, jest gorsze niż
            brak menu. Na telefonie te same pozycje stoją na dole ekranu.
          */}
          <nav className="hidden flex-1 gap-1 sm:flex">
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

          {/* Rozpycha przełączniki na prawo, gdy nawigacja jest schowana. */}
          <span className="flex-1 sm:hidden" />

          {/* Kto jest zalogowany, widać na telefonie w menu Ustawień — w pasku
              zabrałoby to miejsce przyciskom, których używa się co chwilę. */}
          <span className="hidden text-sm text-[var(--muted)] lg:inline">
            {staff.name} · {staff.role}
          </span>

          <SettingsMenu
            items={widoczneUstawienia}
            pathname={pathname}
            staff={staff}
            onLogout={wyloguj}
          />

          {/* W przeciwieństwie do palety dźwięk **zostaje na koncie**: kucharz
              staje przy dowolnym tablecie, a wyciszenie ma iść za nim. */}
          <SoundToggle
            enabled={staff.soundEnabled}
            onChange={(soundEnabled) => onStaffChange({ ...staff, soundEnabled })}
          />

          {/* Kuchnia często pracuje przy słabym świetle — wybór palety
              zostaje na urządzeniu, nie na koncie pracownika. */}
          <ThemeToggle />

          <button
            type="button"
            onClick={wyloguj}
            className="hidden min-h-11 px-3 text-sm text-[var(--muted)] underline sm:inline"
          >
            Wyloguj
          </button>
        </div>
      </header>

      {abonament && <SubscriptionBanner stan={abonament} />}

      {/*
        Zapas na dole robi miejsce pod pasek nawigacji na telefonie. Bez niego
        ostatni kafel sali chowa się pod paskiem i nie da się go stuknąć — a to
        zwykle ten stolik, o który chodzi.
      */}
      <main className="mx-auto max-w-6xl p-4 pb-24 sm:pb-4">{children(staff)}</main>

      <MobileNav items={visible} pathname={pathname} badges={badges} />
    </div>
  );
}

/**
 * Nawigacja na telefonie: pasek na dole, w zasięgu kciuka.
 *
 * Na dole, a nie na górze, bo panel obsługuje się jedną ręką, często w ruchu —
 * górna krawędź telefonu jest wtedy najtrudniejszym miejscem do trafienia.
 * Ikon nie ma: trzy słowa czyta się szybciej niż trzy symbole, których trzeba
 * się nauczyć, a miejsca na trzy pozycje wystarcza.
 */
function MobileNav({
  items,
  pathname,
  badges,
}: {
  items: NavItem[];
  pathname: string;
  badges: Record<string, number> | null;
}) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Nawigacja główna"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[var(--line)] bg-[var(--surface)] sm:hidden print:hidden"
      // Wcięcie na pasek gestów iPhone'a — bez niego dolny rząd przycisków
      // ląduje pod kreską systemową i łapie jej stuknięcia zamiast swoich.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname === item.href ? 'page' : undefined}
          className={`mono flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
            pathname === item.href
              ? 'bg-[var(--teal-wash)] text-[var(--teal)]'
              : 'text-[var(--muted)]'
          }`}
        >
          <span>{item.label}</span>
          <Badge count={badges?.[item.href]} samodzielny />
        </Link>
      ))}
    </nav>
  );
}

/**
 * Pasek o abonamencie.
 *
 * Dwa stany, bo znaczą co innego. Wygasły: nowe zamówienia są wstrzymane i to
 * jest awaria do naprawienia dziś. Kończący się okres próbny: jeszcze wszystko
 * działa, ale warto wiedzieć — ostrzeżenie pokazujemy dopiero na trzy dni przed,
 * bo pasek widoczny przez dwa tygodnie przestaje być zauważany.
 */
function SubscriptionBanner({ stan }: { stan: SubscriptionState }) {
  if (!stan.active) {
    return (
      <p
        role="alert"
        className="mono border-b border-[var(--orange)] bg-[var(--orange-wash)] px-4 py-2.5 text-center text-sm print:hidden"
      >
        <strong>Abonament wygasł.</strong> Nowe zamówienia są wstrzymane — otwarte rachunki
        rozliczysz normalnie.{' '}
        <Link href="/abonament" className="underline">
          Opłać abonament
        </Link>
        .
      </p>
    );
  }

  if (stan.trial && stan.daysLeft !== null && stan.daysLeft <= 3) {
    return (
      <p className="mono border-b border-[var(--line)] bg-[var(--teal-wash)] px-4 py-2.5 text-center text-sm text-[var(--teal)] print:hidden">
        Okres próbny kończy się {stan.daysLeft === 0 ? 'dziś' : `za ${stan.daysLeft} dni`}.{' '}
        <Link href="/abonament" className="underline">
          Wybierz plan
        </Link>
        .
      </p>
    );
  }

  return null;
}

/**
 * Liczba pracy czekającej przy pozycji menu.
 *
 * Sama liczba, nie kropka — kelner ma wiedzieć, czy czeka jedno zamówienie,
 * czy siedem. Zero nie jest informacją, więc serwer go nie zwraca i nic tu nie rysujemy.
 */
/**
 * Licznik czekającej pracy.
 *
 * `samodzielny` zdejmuje odstęp z lewej: w pasku na dole telefonu licznik stoi
 * **pod** etykietą, a nie obok niej, i margines rozjeżdżałby go z osi.
 */
function Badge({ count, samodzielny = false }: { count?: number; samodzielny?: boolean }) {
  if (!count) return null;

  return (
    <span
      aria-label={`${count} do obsługi`}
      className={`mono inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--orange)] px-1.5 py-0.5 text-xs font-bold text-white ${
        samodzielny ? '' : 'ml-2'
      }`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function SettingsMenu({
  items,
  pathname,
  staff,
  onLogout,
}: {
  items: NavItem[];
  pathname: string;
  staff: Staff;
  /** Wylogowanie mieszka tutaj **na telefonie** — w pasku nie ma na nie miejsca. */
  onLogout: () => void;
}) {
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
        className={`mono min-h-11 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-semibold sm:px-4 ${
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
          {/* Na telefonie to jedyne miejsce, w którym widać, kim się jest —
              w pasku nagłówka nazwisko konkurowałoby z przyciskami. */}
          <p className="mono border-b border-[var(--line)] px-4 py-2.5 text-xs text-[var(--muted)] lg:hidden">
            {staff.name} · {staff.role}
          </p>

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

          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="mono min-h-11 rounded-[var(--radius-control)] px-4 py-2.5 text-left text-sm font-semibold text-[var(--muted)] sm:hidden"
          >
            Wyloguj
          </button>
        </div>
      )}
    </div>
  );
}
