import { localePath, type Dictionary, type Locale, type Segment } from '@kelbroo/i18n';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

/**
 * Pięć segmentów na jednej stronie.
 *
 * Jedna strona z kotwicami zamiast pięciu podstron: treść w dużej części jest
 * wspólna, a pięć osobnych stron rozjechałoby się przy pierwszej zmianie
 * w produkcie. Ceną jest słabsze pozycjonowanie pod pojedyncze hasła — gdyby
 * kiedyś liczyło się bardziej niż spójność, sekcje da się rozdzielić bez
 * przepisywania treści.
 *
 * Każdy segment zaczyna się od **obiekcji**, nie od korzyści. Restaurator, który
 * czyta taką stronę, ma już w głowie powód, dla którego to u niego nie zadziała;
 * lista zalet obok niezaadresowanej obawy nie przekonuje nikogo.
 *
 * Treść mieszka w słowniku, bo strona istnieje w czterech językach. Adresy
 * przycisków składa **kod**, nie słownik: gdyby stały w tłumaczeniu, jedna
 * literówka w jednym języku prowadziłaby donikąd i nikt by tego nie zauważył.
 */
const AKCJE: Record<Segment['akcja'], string> = {
  demo: '/#demo',
  cennik: '/#cennik',
  prezentacja: '/#prezentacja',
};

export function SegmentyPage({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const sciezka = (adres: string) => localePath(locale, adres);
  const [otwierajacy, zamykajacy] = dict.dlaKogo.cudzyslow;

  return (
    <>
      <SiteHeader dict={dict} locale={locale} sciezka="/dla-kogo" />

      <main>
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <h2>{dict.dlaKogo.naglowek}</h2>
              <p>{dict.dlaKogo.lede}</p>
            </div>

            <nav
              aria-label={dict.dlaKogo.nawigacja}
              style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
            >
              {dict.dlaKogo.segmenty.map((segment) => (
                <a key={segment.id} className="btn btn-ghost btn-sm" href={`#${segment.id}`}>
                  {segment.nazwa}
                </a>
              ))}
            </nav>
          </div>
        </section>

        {dict.dlaKogo.segmenty.map((segment) => (
          <section
            key={segment.id}
            className="section"
            id={segment.id}
            // Nagłówek jest przyklejony do góry — bez tego kotwica ze stopki
            // chowałaby tytuł sekcji pod paskiem nawigacji.
            style={{ scrollMarginTop: '80px', paddingTop: 0 }}
          >
            <div className="wrap">
              <div className="section-head">
                <h2>{segment.nazwa}</h2>
                <p>{segment.kogo}</p>
              </div>

              <div className="split-card" style={{ marginBottom: '28px' }}>
                {/* Cudzysłów bierzemy ze słownika: polski otwiera na dole,
                    niemiecki zamyka na górze, hiszpański używa daszków. */}
                <h3 style={{ margin: '0 0 10px' }}>
                  {otwierajacy}
                  {segment.obiekcja.pytanie}
                  {zamykajacy}
                </h3>
                <p style={{ margin: 0 }}>{segment.obiekcja.odpowiedz}</p>
              </div>

              <div className="plans">
                {segment.korzysci.map((korzysc) => (
                  <div key={korzysc.tytul} className="plan">
                    <h3>{korzysc.tytul}</h3>
                    <p className="plan-for">{korzysc.opis}</p>
                  </div>
                ))}
              </div>

              <p style={{ marginTop: '24px' }}>
                <a className="btn btn-primary" href={sciezka(AKCJE[segment.akcja])}>
                  {segment.ctaEtykieta}
                </a>
              </p>
            </div>
          </section>
        ))}

        <section className="section">
          <div className="wrap">
            <div className="cta-band">
              <h2>{dict.dlaKogo.band.naglowek}</h2>
              <p>{dict.dlaKogo.band.tresc}</p>
              <div className="cta-actions">
                <a className="btn btn-primary" href={sciezka('/#kontakt')}>
                  {dict.dlaKogo.band.napisz}
                </a>
                <a className="btn btn-ghost" href={sciezka('/rejestracja')}>
                  {dict.dlaKogo.band.zacznij}
                </a>
              </div>
              <p className="cta-fine">{dict.dlaKogo.band.drobne}</p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter dict={dict} locale={locale} />
    </>
  );
}
