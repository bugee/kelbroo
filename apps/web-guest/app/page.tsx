'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { canResume, forgetVisit, storedVisits } from '@/lib/api';

/**
 * Strona startowa aplikacji gościa.
 *
 * Gość trafia tu na dwa sposoby i każdy znaczy co innego. Pierwszy raz — bo
 * wpisał adres z pamięci albo z wizytówki; wtedy jedyną prawdziwą odpowiedzią
 * jest „zeskanuj kod przy stoliku". Drugi — bo zamknął kartę w trakcie posiłku
 * i wraca z historii przeglądarki; wtedy kazanie mu szukać kodu na stoliku,
 * przy którym siedzi, jest wyłącznie naszą niewygodą.
 *
 * **Przekierowanie wymaga potwierdzenia z serwera.** Sam token w pamięci nie
 * wystarcza: wizyta mogła zostać rozliczona, a przy stoliku może siedzieć już
 * kto inny. Wejście z nieaktualnym tokenem nie kończy się błędem — dopisuje
 * gościa do bieżącej wizyty. Przy skanie to jest świadome „dosiadam się tutaj",
 * przy cichym przekierowaniu z zakładki nie byłoby niczym takim.
 */
export default function Home() {
  const router = useRouter();
  // `null` = jeszcze nie wiemy. Rozróżnienie jest istotne: gość bez zapamiętanej
  // wizyty ma zobaczyć ekran skanowania **od razu**, bez pytania serwera o nic.
  const [sprawdzam, setSprawdzam] = useState<boolean | null>(null);

  useEffect(() => {
    const wizyty = storedVisits();
    if (wizyty.length === 0) {
      setSprawdzam(false);
      return;
    }

    let zywy = true;
    void (async () => {
      setSprawdzam(true);
      for (const wizyta of wizyty) {
        if (!zywy) return;
        if (await canResume(wizyta.qrToken, wizyta.guestToken)) {
          router.replace(`/t/${wizyta.qrToken}`);
          return;
        }
        // Wizyta rozliczona albo zastąpiona nową. Wpis jest już bezużyteczny,
        // a zostawiony kazałby pytać o niego przy każdym kolejnym wejściu.
        forgetVisit(wizyta.qrToken);
      }
      if (zywy) setSprawdzam(false);
    })();

    return () => {
      zywy = false;
    };
  }, [router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl">kelbroo</h1>
      {sprawdzam ? (
        // Neutralny komunikat zamiast „Zeskanuj kod QR", które za chwilę zniknie:
        // zdanie pokazane i natychmiast odwołane czyta się jak usterka.
        <p className="mono text-sm text-[var(--muted)]">Sprawdzamy Twój stolik…</p>
      ) : (
        <p className="text-[var(--muted)]">
          Zeskanuj kod QR przy stoliku, żeby zobaczyć menu i zamówić.
        </p>
      )}
    </main>
  );
}
