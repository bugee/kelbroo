import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { ARTYKULY } from '@/lib/pomoc';

export const metadata: Metadata = {
  title: 'Baza wiedzy — kelbroo',
  description:
    'Instrukcje dla restauratora: wprowadzenie karty menu, wydruk kodów QR, ' +
    'obsługa zamówień na zmianie, konta pracowników i abonament.',
};

export default function PomocPage() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <h2>Baza wiedzy</h2>
              <p>
                Sześć artykułów opisujących panel dokładnie tak, jak działa. Jeśli czegoś tu nie ma
                albo coś nie zgadza się z tym, co widzisz na ekranie — napisz na{' '}
                <a href="mailto:kontakt@kelbroo.com">kontakt@kelbroo.com</a>. Instrukcja rozjechana
                z produktem jest gorsza niż jej brak.
              </p>
            </div>

            <div className="plans">
              {ARTYKULY.map((artykul) => (
                <a
                  key={artykul.slug}
                  className="plan"
                  href={`/pomoc/${artykul.slug}`}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <h3>{artykul.tytul}</h3>
                  <p className="plan-for">{artykul.opis}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="cta-band">
              <h2>Nie znalazłeś odpowiedzi?</h2>
              <p>Napisz do nas. Odpowiedź przeczyta człowiek, nie formularz.</p>
              <div className="cta-actions">
                <a className="btn btn-primary" href="/#kontakt">
                  Napisz do nas
                </a>
                <a className="btn btn-ghost" href="/#prezentacja">
                  Umów prezentację
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
