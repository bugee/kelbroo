'use client';

import { useEffect } from 'react';

/** Ceny dań w scenie hero — te same, które sumują się do kwoty na paragonie. */
const CENY = [24, 32, 19];

const zloty = (kwota: number) => kwota.toFixed(2).replace('.', ',');

/**
 * Ruch na stronie produktowej: przyklejona nawigacja, odsłanianie sekcji
 * przy przewijaniu i pętla w scenie hero.
 *
 * Komponent nic nie renderuje — steruje klasami na znacznikach, które przyszły
 * z serwera. To wyjątek od zasady „React trzyma widok", uzasadniony tym, że ta
 * strona nie ma stanu i nigdy się nie przerenderowuje: jedynym stanem jest
 * przełącznik w cenniku, a on siedzi w osobnym komponencie i własnym poddrzewie.
 *
 * Wszystko ustępuje przy `prefers-reduced-motion` — scena pokazuje wtedy stan
 * końcowy od razu, zamiast się nie odbywać.
 */
export function LandingMotion() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sprzatanie: (() => void)[] = [];

    // --- przyklejona nawigacja ---
    const nav = document.getElementById('nav');
    if (nav) {
      const przySkroleniu = () => nav.classList.toggle('stuck', window.scrollY > 8);
      przySkroleniu();
      window.addEventListener('scroll', przySkroleniu, { passive: true });
      sprzatanie.push(() => window.removeEventListener('scroll', przySkroleniu));
    }

    // --- odsłanianie sekcji ---
    const doOdslonienia = Array.from(document.querySelectorAll('.rv'));
    if (reduce || !('IntersectionObserver' in window)) {
      doOdslonienia.forEach((el) => el.classList.add('in'));
    } else {
      const obserwator = new IntersectionObserver(
        (wpisy) => {
          wpisy.forEach((wpis) => {
            if (wpis.isIntersecting) {
              wpis.target.classList.add('in');
              obserwator.unobserve(wpis.target);
            }
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
      );
      doOdslonienia.forEach((el) => obserwator.observe(el));
      sprzatanie.push(() => obserwator.disconnect());
    }

    // --- scena hero: gość dodaje dania, na bonie pojawiają się pozycje ---
    const dania = Array.from(document.querySelectorAll('.dish'));
    const wiersze = Array.from(document.querySelectorAll('.tline'));
    const pieczatka = document.getElementById('stamp');
    const suma = document.getElementById('cartsum');

    if (dania.length > 0 && pieczatka && suma) {
      if (reduce) {
        wiersze.forEach((w) => w.classList.add('on'));
        pieczatka.classList.add('on');
        suma.textContent = zloty(CENY.reduce((a, b) => a + b, 0));
      } else {
        let krok = 0;
        let razem = 0;
        let zegar: ReturnType<typeof setTimeout>;
        const opoznione: ReturnType<typeof setTimeout>[] = [];

        const odNowa = () => {
          krok = 0;
          razem = 0;
          dania.forEach((d) => d.classList.remove('hit'));
          wiersze.forEach((w) => w.classList.remove('on'));
          pieczatka.classList.remove('on');
          suma.textContent = '0,00';
        };

        const takt = () => {
          if (krok < 3) {
            const i = krok;
            dania[i]?.classList.add('hit');
            razem += CENY[i] ?? 0;
            suma.textContent = zloty(razem);
            opoznione.push(
              setTimeout(() => {
                wiersze[i]?.classList.add('on');
                opoznione.push(setTimeout(() => dania[i]?.classList.remove('hit'), 700));
              }, 420),
            );
            krok += 1;
            zegar = setTimeout(takt, 1500);
          } else if (krok === 3) {
            pieczatka.classList.add('on');
            krok += 1;
            zegar = setTimeout(takt, 3200);
          } else {
            odNowa();
            zegar = setTimeout(takt, 900);
          }
        };

        odNowa();
        zegar = setTimeout(takt, 900);

        // Karta w tle nie ma po co animować — pętla wraca dopiero, gdy wróci gość.
        const przyWidocznosci = () => {
          clearTimeout(zegar);
          if (!document.hidden) zegar = setTimeout(takt, 600);
        };
        document.addEventListener('visibilitychange', przyWidocznosci);

        sprzatanie.push(() => {
          clearTimeout(zegar);
          opoznione.forEach(clearTimeout);
          document.removeEventListener('visibilitychange', przyWidocznosci);
        });
      }
    }

    return () => sprzatanie.forEach((zrob) => zrob());
  }, []);

  return null;
}
