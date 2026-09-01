'use client';

import { useState } from 'react';
import { EUR_NET_CENTS, PLANS, type BillingPeriod, type PlanId } from '@kelbroo/types';
import { DEFAULT_LOCALE, localePath, wstaw, type Dictionary, type Locale } from '@kelbroo/i18n';

/**
 * Cennik z przełącznikiem okresu rozliczeniowego.
 *
 * **Ceny pochodzą z katalogu planów, nie ze znaczników.** To ten sam katalog,
 * z którego liczy je checkout — dzięki temu obniżka ceny w jednym miejscu
 * schodzi na stronę i do panelu naraz, zamiast rozjeżdżać się po tygodniu.
 *
 * Wersje obcojęzyczne pokazują **osobny cennik w euro**, nie przeliczenie po
 * kursie dnia: cennik ma być liczbą do zapamiętania. Płatność idzie dziś
 * w złotych i strony obcojęzyczne mówią o tym wprost pod tabelą.
 */
type Okres = 'm' | 'y';

const OKRES: Record<Okres, BillingPeriod> = { m: 'month', y: 'year' };

/**
 * Cena do pokazania na kaflu.
 *
 * Przy rozliczeniu rocznym pokazujemy **kwotę miesięczną w przeliczeniu**, bo
 * kafle porównuje się między sobą, a nie z fakturą — pełną kwotę roczną niesie
 * podpis pod ceną.
 */
function kwotaNetto(plan: PlanId, okres: Okres, locale: Locale): number | null {
  const lista = locale === DEFAULT_LOCALE ? PLANS[plan].netCents : EUR_NET_CENTS[plan];
  const cents = lista[OKRES[okres]];
  if (cents === null) return null;
  return okres === 'y' ? Math.round(cents / 12 / 100) : Math.round(cents / 100);
}

function rocznieRazem(plan: PlanId, locale: Locale): number | null {
  const cents = (locale === DEFAULT_LOCALE ? PLANS[plan].netCents : EUR_NET_CENTS[plan]).year;
  return cents === null ? null : Math.round(cents / 100);
}

/**
 * Kwota z walutą.
 *
 * Symbol stawia `Intl`, nie my: po polsku i po niemiecku waluta idzie **za**
 * liczbą, po angielsku przed nią, a separator tysięcy jest w każdym z tych
 * języków inny. Sklejenie tego ręcznie działa dokładnie dla jednego z nich.
 *
 * Bez części groszowej — cennik ma być liczbą do zapamiętania, a wszystkie
 * kwoty w nim są pełne.
 */
function zWaluta(kwota: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === DEFAULT_LOCALE ? 'pl-PL' : locale, {
    style: 'currency',
    currency: locale === DEFAULT_LOCALE ? 'PLN' : 'EUR',
    maximumFractionDigits: 0,
  }).format(kwota);
}

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

export function Pricing({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const [okres, setOkres] = useState<Okres>('m');
  const t = dict.cennik;

  return (
    <section className="section" id="cennik">
      <div className="wrap">
        <div className="section-head rv" style={{ maxWidth: '60ch' }}>
          <p className="eyebrow">{t.eyebrow}</p>
          <h2>{t.naglowek}</h2>
          <p className="lede" style={{ marginBottom: '22px' }}>
            {t.lede}
          </p>
          <div className="toggle" role="group" aria-label={t.eyebrow}>
            {(
              [
                ['m', t.miesiecznie],
                ['y', t.rocznie],
              ] as const
            ).map(([wartosc, etykieta]) => (
              <button
                key={wartosc}
                type="button"
                className={okres === wartosc ? 'on' : undefined}
                aria-pressed={okres === wartosc}
                onClick={() => setOkres(wartosc)}
              >
                {etykieta}
              </button>
            ))}
          </div>
          <p className="save" id="saveline">
            {okres === 'm' ? t.oszczednoscMiesiecznie : t.oszczednoscRocznie}
          </p>
        </div>

        <div className="plans rv">
          {t.plany.map((plan) => {
            const najlepszy = plan.id === 'pro';
            const kwota = kwotaNetto(plan.id, okres, locale);
            const rocznie = rocznieRazem(plan.id, locale);

            return (
              <div key={plan.id} className={najlepszy ? 'plan best' : 'plan'}>
                {najlepszy && <span className="plan-badge">{t.najlepszy}</span>}
                <h3>{PLANS[plan.id].name}</h3>
                <p className="plan-for">{plan.dlaKogo}</p>
                <div className="price">
                  <b>{kwota === null ? '—' : zWaluta(kwota, locale)}</b>
                  <i>{t.zaMiesiac}</i>
                </div>
                <p className="price-sub">
                  {kwota === null
                    ? t.wycena
                    : kwota === 0
                      ? t.naZawsze
                      : okres === 'm'
                        ? t.rozliczenieMiesieczne
                        : wstaw(t.rozliczenieRoczne, { kwota: zWaluta(rocznie ?? 0, locale) })}
                </p>
                <ul>
                  {plan.cechy.map((cecha) => (
                    <li key={cecha}>
                      <Ptaszek />
                      {cecha}
                    </li>
                  ))}
                </ul>
                <a
                  className={najlepszy ? 'btn btn-primary' : 'btn btn-ghost'}
                  href={localePath(locale, '/rejestracja')}
                >
                  {plan.cta}
                </a>
              </div>
            );
          })}
        </div>

        <div className="pricing-note rv">
          {t.notatki.map((notatka) => (
            <span key={notatka.tytul}>
              <b>{notatka.tytul}</b> {notatka.tresc}
            </span>
          ))}
        </div>

        {/* Zdanie o walucie stoi wyłącznie na stronach obcojęzycznych: płatność
            idzie w złotych, a cennik w euro jest orientacyjny. Przemilczenie
            tego byłoby wprowadzaniem w błąd. */}
        {t.walutaUwaga && (
          <p className="pricing-currency rv" role="note">
            {t.walutaUwaga}
          </p>
        )}
      </div>
    </section>
  );
}
