/**
 * Strona produktowa kelbroo.
 *
 * Znaczniki i style pochodzą wprost z `design/landing-page.html` — pliku, który
 * jest źródłem prawdy dla palety, typografii i tonu (CLAUDE.md). Przeniesienie,
 * nie przeprojektowanie: strona działa na produkcji i nie ma powodu, żeby
 * przy okazji zmieniać jej wygląd.
 *
 * Ruch na stronie — przyklejona nawigacja, odsłanianie sekcji i pętla w hero —
 * siedzi w `LandingMotion`, a cennik w `Pricing`, bo tylko te fragmenty
 * potrzebują przeglądarki. Reszta renderuje się raz, przy budowaniu.
 */
import { localePath, type Dictionary, type Locale } from '@kelbroo/i18n';
import { LandingMotion } from '@/components/LandingMotion';
import { Pricing } from '@/components/Pricing';
import { ContactForm } from '@/components/ContactForm';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import QRCode from 'qrcode';

/**
 * Adres aplikacji gościa. Wkompilowywany przy budowaniu, tak samo jak w panelu,
 * bo strona jest statyczna i nie ma skąd go wziąć w czasie działania.
 */
const GUEST_URL = process.env.NEXT_PUBLIC_GUEST_URL || 'https://menu.kelbroo.com';


/**
 * Znaki rozpoznawcze gości w makiecie rachunku i ikony kafli funkcji.
 *
 * Zostają w kodzie, nie w słowniku: to grafika, nie treść. Kolejność
 * odpowiada kolejności pozycji w słowniku — łączymy je po indeksie.
 */
const ZNAKI_GOSCI = [
  { emoji: '🦡', tlo: 'var(--teal-wash)' },
  { emoji: '🦔', tlo: 'var(--orange-wash)' },
  { emoji: '🦉', tlo: 'var(--teal-wash)' },
  { emoji: '🍷', tlo: 'var(--surface-2)' },
] as const;

const IKONY_FUNKCJI = [
  <>
<svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18" />
                  </svg>
  </>,
  <>
<svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="20" height="14" rx="2" />
                    <path d="M7 8h4M7 12h6M17 8v6" />
                  </svg>
  </>,
  <>
<svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <path d="M14 14h7v7h-7z" />
                  </svg>
  </>,
  <>
<svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.8 6.4 20.1l1.4-6.3L3 9.5l6.4-.6z" />
                  </svg>
  </>,
  <>
<svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 20h18M6 20V10M11 20V4M16 20v-7M21 20v-4" />
                  </svg>
  </>,
  <>
<svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 3.1a4 4 0 0 1 0 7.7M22 21v-2a4 4 0 0 0-3-3.8" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
                  </svg>
  </>,
  <>
<svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="5" width="7" height="7" rx="1" />
                    <rect x="15" y="12" width="7" height="7" rx="1" />
                    <path d="M9 8.5h7a2 2 0 0 1 2 2V12" />
                    <path d="m16 10.5 2 2 2-2" />
                  </svg>
  </>,
] as const;

export async function LandingPage({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const sciezka = (adres: string) => localePath(locale, adres);
  /**
   * Kod QR do restauracji pokazowej, rysowany **przy budowaniu strony**.
   *
   * Nie w przeglądarce: adres jest stały, więc generowanie go u każdego
   * odwiedzającego oznaczałoby dokładanie biblioteki do paczki statycznej
   * strony po to, żeby za każdym razem narysować to samo.
   */
  const kodDemo = await QRCode.toString(`${GUEST_URL}/t/demo`, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
  });

  return (
    <>
      <SiteHeader dict={dict} locale={locale} sciezka="/" />

      {/* ============ HERO ============ */}

      <main id="top">
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <p className="eyebrow">{dict.hero.eyebrow}</p>
              <h1>
                {dict.hero.naglowekPrzed}
                <em>{dict.hero.naglowekAkcent}</em>.
              </h1>
              <p className="lede">{dict.hero.lede}</p>
              <div className="hero-cta">
                <a className="btn btn-primary" href={sciezka('/rejestracja')}>
                  {dict.hero.ctaGlowne}
                </a>
                <a className="btn btn-ghost" href="#demo">
                  {dict.hero.ctaDrugie}
                </a>
              </div>
              <p className="hero-note">
                <b>{dict.hero.notatkaMocna}</b> {dict.hero.notatka}
              </p>
            </div>

            <div className="scene" aria-label={dict.hero.scenaOpis}>
              <div className="phone">
                <div className="phone-screen">
                  <div className="phone-bar">
                    <strong>{dict.makieta.lokal}</strong>
                    <span className="tablechip">{dict.makieta.stolik}</span>
                  </div>
                  <div className="dishes">
                    <div className="dish" data-dish="0">
                      <div className="dish-img"></div>
                      <div className="dish-txt">
                        <b>{dict.makieta.dania[0]!.nazwa}</b>
                        <span>{dict.makieta.dania[0]!.opis}</span>
                      </div>
                      <div className="dish-price">{dict.makieta.dania[0]!.cena}</div>
                    </div>
                    <div className="dish" data-dish="1">
                      <div className="dish-img"></div>
                      <div className="dish-txt">
                        <b>{dict.makieta.dania[1]!.nazwa}</b>
                        <span>{dict.makieta.dania[1]!.opis}</span>
                      </div>
                      <div className="dish-price">{dict.makieta.dania[1]!.cena}</div>
                    </div>
                    <div className="dish" data-dish="2">
                      <div className="dish-img"></div>
                      <div className="dish-txt">
                        <b>{dict.makieta.dania[2]!.nazwa}</b>
                        <span>{dict.makieta.dania[2]!.opis}</span>
                      </div>
                      <div className="dish-price">{dict.makieta.dania[2]!.cena}</div>
                    </div>
                  </div>
                  <div className="phone-foot">
                    {dict.makieta.zamawiam} · <span id="cartsum">0,00</span> {dict.makieta.waluta}
                  </div>
                </div>
              </div>

              <div className="ticket" role="status" aria-live="polite">
                <div className="ticket-top">
                  <span>{dict.makieta.bon}</span>
                  <span>{dict.makieta.godzina}</span>
                </div>
                <h4>{dict.makieta.stolikBon}</h4>
                <div className="rule"></div>
                <div className="ticket-lines">
                  <div className="tline" data-line="0">
                    <b>1×</b>
                    <span>{dict.makieta.dania[0]!.nazwa}</span>
                  </div>
                  <div className="tline" data-line="1">
                    <b>1×</b>
                    <span>
                      {dict.makieta.dania[1]!.nazwa}
                      <i>&rarr; {dict.makieta.bezCebulki}</i>
                    </span>
                  </div>
                  <div className="tline" data-line="2">
                    <b>1×</b>
                    <span>{dict.makieta.dania[2]!.nazwa}</span>
                  </div>
                </div>
                <div className="rule"></div>
                <div className="ticket-stamp" id="stamp">
                  {dict.makieta.stempel}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ TRUST STRIP ============ */}
        <section className="strip">
          <div className="wrap">
            <div className="strip-in">
              {dict.statystyki.map((wpis) => (
                <div className="strip-cell" key={wpis.liczba}>
                  <b>{wpis.liczba}</b>
                  <span>{wpis.opis}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ FLOW ============ */}
        <section className="section" id="jak">
          <div className="wrap">
            <div className="section-head rv">
              <p className="eyebrow">{dict.kroki.eyebrow}</p>
              <h2>{dict.kroki.naglowek}</h2>
              <p className="lede">{dict.kroki.lede}</p>
            </div>
            <div className="flow rv">
              <div className="step">
                <span className="step-ico">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <path d="M14 14h3v3h-3zM20 14v3M17 20h4" />
                  </svg>
                </span>
                <span className="step-n">{dict.kroki.pozycje[0]!.krok}</span>
                <h3>{dict.kroki.pozycje[0]!.tytul}</h3>
                <p>{dict.kroki.pozycje[0]!.tresc}</p>
              </div>
              <div className="step">
                <span className="step-ico">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h2l2.6 10.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 9H6" />
                    <circle cx="10" cy="21" r="1" />
                    <circle cx="18" cy="21" r="1" />
                  </svg>
                </span>
                <span className="step-n">{dict.kroki.pozycje[1]!.krok}</span>
                <h3>{dict.kroki.pozycje[1]!.tytul}</h3>
                <p>{dict.kroki.pozycje[1]!.tresc}</p>
              </div>
              <div className="step">
                <span className="step-ico">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 21V8a8 8 0 0 1 16 0v13z" />
                    <path d="M2 21h20M8 12h8" />
                  </svg>
                </span>
                <span className="step-n">{dict.kroki.pozycje[2]!.krok}</span>
                <h3>{dict.kroki.pozycje[2]!.tytul}</h3>
                <p>{dict.kroki.pozycje[2]!.tresc}</p>
              </div>
              <div className="step">
                <span className="step-ico">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 17h18M5 17a7 7 0 0 1 14 0" />
                    <path d="M12 6.5V4M10.5 4h3" />
                    <path d="M2 20.5h20" />
                  </svg>
                </span>
                <span className="step-n">{dict.kroki.pozycje[3]!.krok}</span>
                <h3>{dict.kroki.pozycje[3]!.tytul}</h3>
                <p>{dict.kroki.pozycje[3]!.tresc}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ PAYMENT MODES ============ */}
        <section
          className="section"
          id="modele"
          style={{ background: 'var(--surface)', borderBlock: '1px solid var(--line)' }}
        >
          <div className="wrap">
            <div className="section-head rv">
              <p className="eyebrow">{dict.modele.eyebrow}</p>
              <h2>{dict.modele.naglowek}</h2>
              <p className="lede">{dict.modele.lede}</p>
            </div>
            {/* `.modes` to siatka dwukolumnowa — z jedną kartą (płatność
                w aplikacji czeka na etap 2) zostawiałaby pustą połowę ekranu. */}
            <div className="modes rv" style={{ gridTemplateColumns: 'minmax(0, 680px)' }}>
              <div className="mode feature">
                <span className="mode-tag">{dict.modele.kartaTag}</span>
                <h3>{dict.modele.kartaTytul}</h3>
                <p>{dict.modele.kartaLede}</p>
                <ul>
                  {dict.modele.zalety.map((zaleta) => (
                    <li key={zaleta}>
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
                      {zaleta}
                    </li>
                  ))}
                </ul>
                <p className="mode-foot">{dict.modele.przygotowujemy}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ SPLIT BILL ============ */}
        <section className="section">
          <div className="wrap split-wrap">
            <div className="rv">
              <p className="eyebrow">{dict.podzial.eyebrow}</p>
              <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: '700', marginBottom: '16px' }}>
                {dict.podzial.naglowek}
              </h2>
              <p className="lede" style={{ marginBottom: '22px' }}>{dict.podzial.lede}</p>
              <p className="lede" style={{ marginBottom: '26px' }}>{dict.podzial.zestawienie}</p>
              <a className="btn btn-ghost" href="#funkcje">
                {dict.podzial.ctaFunkcje}
              </a>
            </div>
            <div className="split-card rv">
              <div className="split-head">
                <b>{dict.podzial.rachunekTytul}</b>
                <span>{dict.podzial.rachunekPodpis}</span>
              </div>
              {dict.podzial.goscie.map((gosc, index) => (
                <div className="guest" key={gosc.nick}>
                  <div className="av" style={{ background: ZNAKI_GOSCI[index]!.tlo }}>
                    {ZNAKI_GOSCI[index]!.emoji}
                  </div>
                  <div className="guest-txt">
                    <b>{gosc.nick}</b>
                    <span>{gosc.dania}</span>
                  </div>
                  <div className="guest-sum">{gosc.kwota}</div>
                </div>
              ))}
              <div className="split-total">
                <span>{dict.podzial.razem}</span>
                <span>{dict.podzial.razemKwota}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============ FEATURES ============ */}
        <section
          className="section"
          id="funkcje"
          style={{ background: 'var(--surface)', borderBlock: '1px solid var(--line)' }}
        >
          <div className="wrap">
            <div className="section-head rv">
              <p className="eyebrow">{dict.funkcje.eyebrow}</p>
              <h2>{dict.funkcje.naglowek}</h2>
            </div>
            <div className="feats rv">
              {dict.funkcje.pozycje.map((funkcja, index) => (
                <div className="feat" key={funkcja.tytul}>
                  <div className="feat-ico">{IKONY_FUNKCJI[index]}</div>
                  <h3>{funkcja.tytul}</h3>
                  <p>{funkcja.tresc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ PRICING ============ */}

        <Pricing dict={dict} locale={locale} />

        {/* ============ FAQ ============ */}
        <section
          className="section"
          id="faq"
          style={{ background: 'var(--surface)', borderBlock: '1px solid var(--line)' }}
        >
          <div className="wrap">
            <div className="section-head rv">
              <p className="eyebrow">{dict.faq.eyebrow}</p>
              <h2>{dict.faq.naglowek}</h2>
            </div>
            <div className="faq rv">
              {/* Pierwsze pytanie otwarte: pokazuje, że to rozwijane bloki,
                  a nie lista nagłówków. */}
              {dict.faq.pozycje.map((pozycja, index) => (
                <details key={pozycja.pytanie} open={index === 0}>
                  <summary>{pozycja.pytanie}</summary>
                  <p>{pozycja.odpowiedz}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ============ CTA ============ */}
        <section className="section" id="trial">
          <div className="wrap">
            <div className="cta-band rv">
              <h2>{dict.finalCta.naglowek}</h2>
              <p>{dict.finalCta.lede}</p>
              <div className="cta-actions">
                <a className="btn btn-primary" href={sciezka('/rejestracja')}>
                  {dict.finalCta.przycisk}
                </a>
                <a className="btn btn-ghost" href="#prezentacja">
                  {dict.kontakt.prezentacja}
                </a>
              </div>
              <p className="cta-fine">{dict.finalCta.notatka}</p>
            </div>
          </div>
        </section>

        {/* ============ DEMO ============ */}
        <section className="section" id="demo">
          <div className="wrap">
            <div className="section-head rv">
              <h2>{dict.demo.naglowek}</h2>
              <p>{dict.demo.lede}</p>
            </div>

            <div className="cta-band rv">
              <h2>{dict.demo.stolikTytul}</h2>
              <p>{dict.demo.drugi}</p>
              {/*
                Kod QR zamiast przycisku, bo tak wygląda ta usługa naprawdę:
                gość siada, wyjmuje telefon i skanuje. Przycisk otwierałby menu
                na monitorze — czyli na urządzeniu, na którym nikt tego nie używa.

                Kod jest zarazem odnośnikiem: kto czyta stronę na telefonie, nie
                zeskanuje własnego ekranu i po prostu w niego stuknie.
              */}
              <a
                href={`${GUEST_URL}/t/demo`}
                className="demo-qr"
                aria-label={`${dict.demo.kodPodpis} — ${dict.demo.kodPodpisStuknij}`}
              >
                <span className="demo-qr-code" dangerouslySetInnerHTML={{ __html: kodDemo }} />
                <span className="demo-qr-label mono">
                  {dict.demo.kodPodpis}
                  <br />
                  <span className="demo-qr-tap">{dict.demo.kodPodpisStuknij}</span>
                </span>
              </a>

              <div className="cta-actions">
                <a className="btn btn-ghost" href="#prezentacja">
                  {dict.demo.pokazPanel}
                </a>
              </div>
              <p className="cta-fine">{dict.demo.zastrzezenie}</p>
            </div>
          </div>
        </section>

        {/* ============ KONTAKT ============ */}
        <section className="section" id="kontakt">
          <div className="wrap">
            <div className="section-head rv">
              <h2>{dict.kontakt.naglowek}</h2>
              <p>{dict.kontakt.lede}</p>
            </div>

            {/* `align-items: center` z .split-wrap zostawiłoby prawą kolumnę
                zawieszoną w pionie obok wysokiego formularza. */}
            <div
              className="split-wrap rv"
              id="prezentacja"
              style={{
                alignItems: 'flex-start',
                // Nagłówek jest przyklejony do góry: bez tego skok do
                // `#prezentacja` chowa początek formularza pod paskiem.
                scrollMarginTop: '96px',
              }}
            >
              <ContactForm dict={dict} locale={locale} />

              <div>
                <h3>{dict.kontakt.formularzTytul}</h3>
                <p>
                  <a href="mailto:kontakt@kelbroo.com">kontakt@kelbroo.com</a>
                </p>

                {/* Dane identyfikujące usługodawcę. Nie jest to sekcja „o nas":
                    przy sprzedaży usług drogą elektroniczną muszą być podane
                    w sposób łatwo dostępny. */}
                <h3 style={{ marginTop: '28px' }}>{dict.stopka.daneFirmy}</h3>
                <address className="mono" style={{ fontStyle: 'normal', lineHeight: 1.7 }}>
                  Kelbroo
                  <br />
                  ul. Rodła 24/4
                  <br />
                  01-496 Warszawa
                  <br />
                  NIP: 5222269366
                </address>

                {/* Zdanie z dwoma odnośnikami w środku: w słowniku trzymamy je
                    jako jeden tekst, a nazwy dokumentów doklejamy jako osobne
                    odnośniki pod spodem. Dzielenie zdania na kawałki wokół
                    znaczników jest nieprzetłumaczalne — szyk zdania różni się
                    w każdym języku. */}
                <p style={{ marginTop: '20px' }}>{dict.stopka.warunki}</p>
                <p className="mono" style={{ marginTop: '8px', fontSize: '13px' }}>
                  <a href={sciezka('/regulamin')}>{dict.stopka.regulamin}</a>
                  {' · '}
                  <a href={sciezka('/prywatnosc')}>{dict.stopka.prywatnosc}</a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ============ FOOTER ============ */}
      <SiteFooter dict={dict} locale={locale} />

      <LandingMotion />
    </>
  );
}
