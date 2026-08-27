'use client';

import { useState } from 'react';

/**
 * Cennik z przełącznikiem okresu rozliczeniowego.
 *
 * W pliku projektowym ceny siedziały w atrybutach `data-m` i `data-y`, a skrypt
 * podmieniał je w miejscu. Tutaj są danymi: przełącznik jest jedynym stanem na
 * całej stronie, a podpięcie zakupu abonamentu będzie potrzebowało dokładnie
 * tej listy, nie znaczników.
 */
type Okres = 'm' | 'y';

interface Plan {
  nazwa: string;
  dlaKogo: string;
  cena: Record<Okres, string>;
  podpis?: Record<Okres, string>;
  /** Gdy plan ma jeden podpis niezależny od okresu — np. „wycena indywidualna". */
  podpisStaly?: string;
  cechy: string[];
  cta: { etykieta: string; href: string };
  najlepszy?: boolean;
}

const PLANY: Plan[] = [
  {
    nazwa: 'Menu',
    dlaKogo: 'Cyfrowa karta z kodem QR, bez zamawiania',
    cena: { m: '0', y: '0' },
    podpisStaly: 'na zawsze za darmo',
    cechy: ['Kody QR bez limitu', '1 język, do 10 pozycji', 'Aktualizacja karty w minutę'],
    cta: { etykieta: 'Załóż konto', href: '/rejestracja' },
  },
  {
    nazwa: 'Starter',
    dlaKogo: 'Kawiarnia, mały lokal, food truck',
    cena: { m: '159', y: '132' },
    podpis: { m: 'rozliczenie miesięczne', y: '1 590 zł rocznie' },
    cechy: [
      'Do 12 stolików, 2 języki, 50 pozycji',
      // Płatność gościa w aplikacji należy do etapu 2 i nie istnieje — cennik
      // obiecywał ją do 2026-08-26, mimo że plan Starter da się kupić dziś.
      'Zamawianie do stolika, płatność u kelnera',
      'Ekran kuchni i panel kelnera',
      'Podział „każdy za siebie”',
      '3 konta personelu',
    ],
    cta: { etykieta: 'Wybierz Starter', href: '/rejestracja' },
  },
  {
    nazwa: 'Pro',
    dlaKogo: 'Restauracja z pełną obsługą kelnerską',
    cena: { m: '349', y: '291' },
    podpis: { m: 'rozliczenie miesięczne', y: '3 490 zł rocznie' },
    cechy: [
      'Do 40 stolików, 6 języków, karta bez limitu',
      'Zdjęcia dań w karcie',
      'Podział rachunku po pozycjach i grupami',
      'Oceny dań i feedback do managera',
      'Analityka i eksport raportów',
      'Konta personelu bez limitu',
      'Wsparcie w 4 godziny',
    ],
    cta: { etykieta: 'Testuj 14 dni', href: '/rejestracja' },
    najlepszy: true,
  },
  {
    nazwa: 'Enterprise',
    dlaKogo: 'Sieć restauracji, hotel, food court',
    cena: { m: '899', y: '749' },
    podpisStaly: 'wycena indywidualna',
    cechy: [
      'Wiele lokali, bez limitów',
      'Integracja z kasą fiskalną i POS',
      'Własna domena i branding',
      'Opiekun klienta i SLA 99,9%',
    ],
    // Enterprise to sieci i hotele — te nie zakładają konta samodzielnie,
    // więc kierujemy je od razu na prezentację, a nie na ogólne pytanie.
    cta: { etykieta: 'Porozmawiajmy', href: '#prezentacja' },
  },
];

const OSZCZEDNOSC: Record<Okres, string> = {
  m: 'Przy płatności rocznej oszczędzasz 17% — dwa miesiące gratis.',
  y: 'Rozliczenie roczne — dwa miesiące gratis w cenie.',
};

function Ptaszek() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

export function Pricing() {
  const [okres, setOkres] = useState<Okres>('m');

  return (
    <section className="section" id="cennik">
      <div className="wrap">
        <div className="section-head rv" style={{ maxWidth: '60ch' }}>
          <p className="eyebrow">Cennik</p>
          <h2>Stały abonament. Zero prowizji od zamówień.</h2>
          <p className="lede" style={{ marginBottom: '22px' }}>
            Ceny netto za jeden lokal. Bez umowy na czas określony — rezygnujesz, kiedy chcesz.
          </p>
          <div className="toggle" role="group" aria-label="Okres rozliczeniowy">
            <button
              type="button"
              className={okres === 'm' ? 'on' : undefined}
              aria-pressed={okres === 'm'}
              onClick={() => setOkres('m')}
            >
              Miesięcznie
            </button>
            <button
              type="button"
              className={okres === 'y' ? 'on' : undefined}
              aria-pressed={okres === 'y'}
              onClick={() => setOkres('y')}
            >
              Rocznie
            </button>
          </div>
          <p className="save" id="saveline">
            {OSZCZEDNOSC[okres]}
          </p>
        </div>

        <div className="plans rv">
          {PLANY.map((plan) => (
            <div key={plan.nazwa} className={plan.najlepszy ? 'plan best' : 'plan'}>
              {plan.najlepszy && <span className="plan-badge">Najpopularniejszy</span>}
              <h3>{plan.nazwa}</h3>
              <p className="plan-for">{plan.dlaKogo}</p>
              <div className="price">
                <b>{plan.cena[okres]}</b>
                <i>zł / mies.</i>
              </div>
              <p className="price-sub">{plan.podpisStaly ?? plan.podpis?.[okres]}</p>
              <ul>
                {plan.cechy.map((cecha) => (
                  <li key={cecha}>
                    <Ptaszek />
                    {cecha}
                  </li>
                ))}
              </ul>
              <a
                className={plan.najlepszy ? 'btn btn-primary' : 'btn btn-ghost'}
                href={plan.cta.href}
              >
                {plan.cta.etykieta}
              </a>
            </div>
          ))}
        </div>

        <div className="pricing-note rv">
          <span>
            <b>Rabaty dla sieci:</b> 3–9 lokali −15%, 10+ lokali −25%
          </span>
          <span>
            <b>Dodatki:</b> +10 stolików 49 zł · dodatkowy język 39 zł
          </span>
          <span>
            <b>Do wszystkich cen</b> doliczamy VAT
          </span>
        </div>
      </div>
    </section>
  );
}
