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

export default async function LandingPage() {
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
      <SiteHeader />

      {/* ============ HERO ============ */}

      <main id="top">
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <p className="eyebrow">Self-service dining</p>
              <h1>
                Goście zamawiają z telefonu. Kelnerzy wracają <em>do gości</em>.
              </h1>
              <p className="lede">
                kelbroo zamienia kod QR na stoliku w pełne menu, zamówienie i rachunek. Bez
                aplikacji do pobrania, bez rejestracji gościa i bez zmiany Twojej kasy fiskalnej.
              </p>
              <div className="hero-cta">
                <a className="btn btn-primary" href="/rejestracja">
                  Zacznij 14 dni za darmo
                </a>
                <a className="btn btn-ghost" href="#demo">
                  Zobacz demo menu
                </a>
              </div>
              <p className="hero-note">
                <b>Bez karty na start.</b> Wdrożenie w jeden dzień.
              </p>
            </div>

            <div className="scene" aria-label="Podgląd: zamówienie gościa trafia na bon kuchenny">
              <div className="phone">
                <div className="phone-screen">
                  <div className="phone-bar">
                    <strong>Bistro Nadwiślańskie</strong>
                    <span className="tablechip">Stolik 12</span>
                  </div>
                  <div className="dishes">
                    <div className="dish" data-dish="0">
                      <div className="dish-img"></div>
                      <div className="dish-txt">
                        <b>Żurek na zakwasie</b>
                        <span>jajko, biała kiełbasa</span>
                      </div>
                      <div className="dish-price">24,00</div>
                    </div>
                    <div className="dish" data-dish="1">
                      <div className="dish-img"></div>
                      <div className="dish-txt">
                        <b>Pierogi ruskie</b>
                        <span>8 szt., cebulka</span>
                      </div>
                      <div className="dish-price">32,00</div>
                    </div>
                    <div className="dish" data-dish="2">
                      <div className="dish-img"></div>
                      <div className="dish-txt">
                        <b>Sernik wiedeński</b>
                        <span>sos malinowy</span>
                      </div>
                      <div className="dish-price">19,00</div>
                    </div>
                  </div>
                  <div className="phone-foot">
                    Zamawiam · <span id="cartsum">0,00</span> zł
                  </div>
                </div>
              </div>

              <div className="ticket" role="status" aria-live="polite">
                <div className="ticket-top">
                  <span>BON KUCHENNY</span>
                  <span>18:42</span>
                </div>
                <h4>STOLIK 12</h4>
                <div className="rule"></div>
                <div className="ticket-lines">
                  <div className="tline" data-line="0">
                    <b>1×</b>
                    <span>Żurek na zakwasie</span>
                  </div>
                  <div className="tline" data-line="1">
                    <b>1×</b>
                    <span>
                      Pierogi ruskie<i>&rarr; bez cebulki</i>
                    </span>
                  </div>
                  <div className="tline" data-line="2">
                    <b>1×</b>
                    <span>Sernik wiedeński</span>
                  </div>
                </div>
                <div className="rule"></div>
                <div className="ticket-stamp" id="stamp">
                  NA KUCHNIĘ
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ TRUST STRIP ============ */}
        <section className="strip">
          <div className="wrap">
            <div className="strip-in">
              <div className="strip-cell">
                <b>0 zł</b>
                <span>prowizji od zamówień — płacisz tylko abonament</span>
              </div>
              <div className="strip-cell">
                <b>0 instalacji</b>
                <span>gość skanuje kod i zamawia w przeglądarce</span>
              </div>
              <div className="strip-cell">
                <b>6 języków</b>
                <span>menu tłumaczone dla gości zagranicznych</span>
              </div>
              <div className="strip-cell">
                <b>1 dzień</b>
                <span>od rejestracji do pierwszego zamówienia</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============ FLOW ============ */}
        <section className="section" id="jak">
          <div className="wrap">
            <div className="section-head rv">
              <p className="eyebrow">Przy stoliku</p>
              <h2>Cztery kroki, zero przepisywania zamówień</h2>
              <p className="lede">
                Zamówienie idzie prosto z telefonu gościa na ekran kuchni. Nikt niczego nie notuje
                na kartce i nikt nie myli stolików.
              </p>
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
                <span className="step-n">KROK 01</span>
                <h3>Gość skanuje kod</h3>
                <p>
                  Kod QR na stoliku otwiera menu w przeglądarce. Bez pobierania aplikacji, bez
                  zakładania konta.
                </p>
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
                <span className="step-n">KROK 02</span>
                <h3>Składa zamówienie</h3>
                <p>
                  Wybiera dania, dodatki i uwagi. Widzi alergeny, zdjęcia i czas przygotowania — po
                  polsku albo w swoim języku.
                </p>
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
                <span className="step-n">KROK 03</span>
                <h3>Kuchnia widzi bon</h3>
                <p>
                  Zamówienie pojawia się na ekranie kuchni z numerem stolika i licznikiem czasu.
                  Kelner może je najpierw potwierdzić przy stoliku.
                </p>
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
                <span className="step-n">KROK 04</span>
                <h3>Kelner podaje</h3>
                <p>
                  Gotowe dania trafiają na listę „do wydania". Kelner zanosi je do stolika i zamyka
                  rachunek.
                </p>
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
              <p className="eyebrow">Bez zmian u Ciebie</p>
              <h2>Goście zamawiają z telefonu, płacą kelnerowi — jak dotąd</h2>
              <p className="lede">
                Najczęstsza obawa restauratorów brzmi: „nie chcę zmieniać sposobu płacenia ani kasy
                fiskalnej". Nie musisz. kelbroo zmienia sposób <em>zamawiania</em>, a rozliczenie
                zostawia dokładnie tam, gdzie jest dzisiaj.
              </p>
            </div>
            {/* `.modes` to siatka dwukolumnowa — z jedną kartą (płatność
                w aplikacji czeka na etap 2) zostawiałaby pustą połowę ekranu. */}
            <div className="modes rv" style={{ gridTemplateColumns: 'minmax(0, 680px)' }}>
              <div className="mode feature">
                <span className="mode-tag">Bez opłat transakcyjnych</span>
                <h3>Płatność u kelnera</h3>
                <p>
                  Goście tylko zamawiają z telefonu. Wszystko z wizyty sumuje się w jeden rachunek,
                  który kelner rozlicza po posiłku — na Twojej kasie, Twoim terminalem.
                </p>
                <ul>
                  <li>
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
                    Paragon wystawiasz jak dotychczas — bez integracji z kasą
                  </li>
                  <li>
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
                    Zero prowizji operatora płatności
                  </li>
                  <li>
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
                    Kelner może potwierdzać każde zamówienie przy stoliku
                  </li>
                  <li>
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
                    Raport rozliczenia zmiany dla każdego kelnera
                  </li>
                </ul>
                <p className="mode-foot">
                  Płatność gościa w aplikacji (BLIK, karta, Apple&nbsp;Pay) przygotowujemy — napisz,
                  jeśli to dla Ciebie ważne.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ SPLIT BILL ============ */}
        <section className="section">
          <div className="wrap split-wrap">
            <div className="rv">
              <p className="eyebrow">Koniec sporów o rachunek</p>
              <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: '700', marginBottom: '16px' }}>
                Każdy skanuje ten sam kod i płaci za siebie
              </h2>
              <p className="lede" style={{ marginBottom: '22px' }}>
                Goście przy jednym stoliku dołączają do wspólnej wizyty — każdy dostaje nick i znak
                rozpoznawczy, a kto chce, wpisuje własną nazwę. Bez zakładania konta. Potem
                rozliczają się osobno, w grupach albo po równo.
              </p>
              <p className="lede" style={{ marginBottom: '26px' }}>
                Gdy płaci jedna osoba, każdy może wysłać sobie na e-mail zestawienie „kto co
                zamówił" — gotowe do rozliczenia delegacji.
              </p>
              <a className="btn btn-ghost" href="#funkcje">
                Zobacz wszystkie funkcje
              </a>
            </div>
            <div className="split-card rv">
              <div className="split-head">
                <b>Rachunek stolika</b>
                <span>STOLIK 12 · 4 osoby</span>
              </div>
              <div className="guest">
                <div className="av" style={{ background: 'var(--teal-wash)' }}>
                  🦡
                </div>
                <div className="guest-txt">
                  <b>Wesoły Borsuk</b>
                  <span>Żurek, pierogi ruskie</span>
                </div>
                <div className="guest-sum">56,00 zł</div>
              </div>
              <div className="guest">
                <div className="av" style={{ background: 'var(--orange-wash)' }}>
                  🦔
                </div>
                <div className="guest-txt">
                  <b>Szybki Jeż</b>
                  <span>Schabowy, kompot</span>
                </div>
                <div className="guest-sum">62,00 zł</div>
              </div>
              <div className="guest">
                <div className="av" style={{ background: 'var(--teal-wash)' }}>
                  🦉
                </div>
                <div className="guest-txt">
                  <b>Nocna Sowa</b>
                  <span>Sernik, espresso</span>
                </div>
                <div className="guest-sum">31,00 zł</div>
              </div>
              <div className="guest">
                <div className="av" style={{ background: 'var(--surface-2)' }}>
                  🍷
                </div>
                <div className="guest-txt">
                  <b>Dzielone na 3</b>
                  <span>Wino domowe, karafka</span>
                </div>
                <div className="guest-sum">69,00 zł</div>
              </div>
              <div className="split-total">
                <span>RAZEM</span>
                <span>218,00 zł</span>
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
              <p className="eyebrow">W każdym planie</p>
              <h2>Wszystko, czego potrzebuje sala i kuchnia</h2>
            </div>
            <div className="feats rv">
              <div className="feat">
                <div className="feat-ico">
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
                </div>
                <h3>Menu w wielu językach</h3>
                <p>
                  Gość dostaje kartę w swoim języku automatycznie. Brakujące tłumaczenie zawsze
                  zastępuje wersja polska — nigdy pusty ekran.
                </p>
              </div>
              <div className="feat">
                <div className="feat-ico">
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
                </div>
                <h3>Ekran kuchni (KDS)</h3>
                <p>
                  Kolumny „nowe / w przygotowaniu / gotowe", licznik czasu i alarm dźwiękowy.
                  Zamówienie czerwienieje, gdy czeka za długo.
                </p>
              </div>
              <div className="feat">
                <div className="feat-ico">
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
                </div>
                <h3>Kody QR na stoliki</h3>
                <p>
                  Generujesz je w panelu z własnym logo i pobierasz gotowy arkusz A4 do wydruku —
                  naklejki, stojaki albo karty.
                </p>
              </div>
              <div className="feat">
                <div className="feat-ico">
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
                </div>
                <h3>Oceny dań i feedback</h3>
                <p>
                  Gość ocenia każde danie po posiłku. Uwaga krytyczna trafia prosto do managera —
                  zanim wyląduje w publicznej recenzji.
                </p>
              </div>
              <div className="feat">
                <div className="feat-ico">
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
                </div>
                <h3>Raporty i analityka</h3>
                <p>
                  Które dania sprzedają się najlepiej, które nikt nie zamawia, o której masz szczyt
                  i ile czasu zajmuje wydanie zamówienia.
                </p>
              </div>
              <div className="feat">
                <div className="feat-ico">
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
                </div>
                <h3>Kelner zamawia i poprawia</h3>
                <p>
                  Obsługa może złożyć zamówienie za gościa i je skorygować. W historii zawsze widać,
                  co dodał gość, a co kelner.
                </p>
              </div>
              <div className="feat">
                <div className="feat-ico">
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
                </div>
                <h3>Przesiadka bez rozliczania</h3>
                <p>
                  Goście przenoszą się przy inny stolik jednym kliknięciem — rachunek, zamówienia i
                  bony w kuchni idą za nimi. Stary stolik zwalnia się od razu.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ PRICING ============ */}

        <Pricing />

        {/* ============ FAQ ============ */}
        <section
          className="section"
          id="faq"
          style={{ background: 'var(--surface)', borderBlock: '1px solid var(--line)' }}
        >
          <div className="wrap">
            <div className="section-head rv">
              <p className="eyebrow">Pytania restauratorów</p>
              <h2>Zanim zapytasz</h2>
            </div>
            <div className="faq rv">
              <details open>
                <summary>Czy goście muszą instalować aplikację?</summary>
                <p>
                  Nie. Zeskanowanie kodu QR otwiera menu w przeglądarce telefonu — tak samo jak
                  zwykłą stronę. Gość nie zakłada konta, nie podaje maila ani numeru telefonu.
                </p>
              </details>
              <details>
                <summary>Czy muszę przyjmować płatności online?</summary>
                <p>
                  Nie — i dziś nawet nie możesz. Goście wyłącznie zamawiają z telefonu, a płacą
                  kelnerowi po posiłku, dokładnie jak dotychczas. Nie ponosisz żadnych opłat
                  transakcyjnych i nic nie zmienia się w Twoim obiegu płatności ani w kasie
                  fiskalnej. Płatność gościa w aplikacji przygotowujemy.
                </p>
              </details>
              <details>
                <summary>A co z paragonami i kasą fiskalną?</summary>
                <p>
                  W trybie płatności u kelnera paragon wystawiasz na swojej kasie, tak jak zawsze —
                  kelbroo w ogóle nie wchodzi w fiskalizację. Przy płatnościach online dostępna jest
                  integracja z Twoją kasą lub drukarką fiskalną.
                </p>
              </details>
              <details>
                <summary>Czy to zastąpi kelnerów?</summary>
                <p>
                  Nie. Zdejmuje z nich przyjmowanie zamówień i bieganie po terminal, więc mają czas
                  na to, za co goście naprawdę doceniają obsługę: doradzanie, dopilnowanie stolika,
                  rozmowę. Kelner może też sam składać zamówienia w aplikacji, gdy gość woli zamówić
                  ustnie.
                </p>
              </details>
              <details>
                <summary>Czy kelner może poprawić zamówienie gościa?</summary>
                <p>
                  Tak. Może dodać pozycję, zmienić ilość albo przepisać danie na inną osobę przy
                  stoliku. Każda zmiana zapisuje się w historii zamówienia, więc zawsze widać, co
                  dodał gość, a co obsługa.
                </p>
              </details>
              <details>
                <summary>Potrzebuję nowego sprzętu?</summary>
                <p>
                  Wystarczy dowolny tablet, laptop lub komputer z przeglądarką. Panel kuchni i panel
                  kelnera otwierasz pod adresem panel.kelbroo.com — działają tak samo na iPadzie, na
                  tablecie z Androidem i na komputerze. Nie ma nic do instalowania.
                </p>
              </details>
              <details>
                <summary>Co się stanie, gdy padnie internet?</summary>
                <p>
                  kelbroo wymaga połączenia — bez internetu ani gość, ani obsługa nie złożą
                  zamówienia. Zobaczycie wtedy czytelny komunikat, a nie pusty ekran. Jeśli wi-fi w
                  lokalu bywa zawodne, warto mieć na tablecie zapasowy internet z telefonu.
                </p>
              </details>
              <details>
                <summary>Jak płacę za abonament?</summary>
                <p>
                  Po założeniu konta wybierasz plan w panelu i płacisz BLIK-iem, przelewem albo
                  kartą — obsługuje to PayU. Możesz zapłacić za miesiąc albo za rok (wtedy dwa
                  miesiące taniej). Fakturę VAT wystawiamy na dane Twojej firmy i wysyłamy mailem.
                  Nie pobieramy żadnej prowizji od zamówień gości.
                </p>
              </details>
              <details>
                <summary>Ile trwa wdrożenie?</summary>
                <p>
                  Konfiguracja lokalu, wprowadzenie menu i wydruk kodów QR to zwykle jeden dzień.
                  Możemy też wprowadzić menu za Ciebie w ramach wdrożenia „pod klucz".
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* ============ CTA ============ */}
        <section className="section" id="trial">
          <div className="wrap">
            <div className="cta-band rv">
              <h2>Pierwsze zamówienie ze stolika jeszcze dziś</h2>
              <p>
                Załóż konto, dodaj stoliki i menu, wydrukuj kody QR. 14 dni planu Pro bez opłat i
                bez podawania karty.
              </p>
              <div className="cta-actions">
                <a className="btn btn-primary" href="/rejestracja">
                  Zacznij za darmo
                </a>
                <a className="btn btn-ghost" href="#prezentacja">
                  Umów prezentację
                </a>
              </div>
              <p className="cta-fine">
                Bez karty · bez umowy na czas określony · bez prowizji od zamówień
              </p>
            </div>
          </div>
        </section>

        {/* ============ DEMO ============ */}
        <section className="section" id="demo">
          <div className="wrap">
            <div className="section-head rv">
              <h2>Zobacz to oczami gościa</h2>
              <p>
                Otwórz menu pokazowej restauracji dokładnie tak, jak zrobiłby to gość po
                zeskanowaniu kodu QR przy stoliku. Bez zakładania konta i bez instalowania
                czegokolwiek — to ta sama aplikacja, którą dostaje Twój lokal.
              </p>
            </div>

            <div className="cta-band rv">
              <h2>Bistro Widok — stolik pokazowy</h2>
              <p>
                Przejrzysz kartę w dwóch językach, dodasz danie do koszyka i złożysz zamówienie.
                Zobaczysz też, jak wygląda wspólny rachunek, gdy przy stoliku siedzi więcej osób.
              </p>
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
                aria-label="Menu restauracji pokazowej — zeskanuj telefonem albo stuknij"
              >
                <span className="demo-qr-code" dangerouslySetInnerHTML={{ __html: kodDemo }} />
                <span className="demo-qr-label mono">
                  Zeskanuj telefonem
                  <br />
                  <span className="demo-qr-tap">albo stuknij, jeśli czytasz na telefonie</span>
                </span>
              </a>

              <div className="cta-actions">
                <a className="btn btn-ghost" href="#prezentacja">
                  Pokaż mi panel kuchni
                </a>
              </div>
              <p className="cta-fine">
                Zamówienia z demo nie trafiają do żadnej kuchni. Panel obsługi i KDS pokazujemy na
                żywo podczas prezentacji.
              </p>
            </div>
          </div>
        </section>

        {/* ============ KONTAKT ============ */}
        <section className="section" id="kontakt">
          <div className="wrap">
            <div className="section-head rv">
              <h2>Porozmawiajmy</h2>
              <p>
                Napisz, jeśli masz pytanie — albo umów prezentację, na której pokażemy panel na żywo
                i przejdziemy przez zamówienie od skanu kodu QR do wydania z kuchni. Odpowiadamy w
                ciągu jednego dnia roboczego.
              </p>
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
              <ContactForm />

              <div>
                <h3>Wolisz napisać wprost?</h3>
                <p>
                  <a href="mailto:kontakt@kelbroo.com">kontakt@kelbroo.com</a>
                </p>

                {/* Dane identyfikujące usługodawcę. Nie jest to sekcja „o nas":
                    przy sprzedaży usług drogą elektroniczną muszą być podane
                    w sposób łatwo dostępny. */}
                <h3 style={{ marginTop: '28px' }}>Dane firmy</h3>
                <address className="mono" style={{ fontStyle: 'normal', lineHeight: 1.7 }}>
                  Kelbroo
                  <br />
                  ul. Rodła 24/4
                  <br />
                  01-496 Warszawa
                  <br />
                  NIP: 5222269366
                </address>

                <p style={{ marginTop: '20px' }}>
                  Warunki współpracy opisuje <a href="/regulamin">regulamin</a>, a przetwarzanie
                  danych — <a href="/prywatnosc">polityka prywatności</a>.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ============ FOOTER ============ */}
      <SiteFooter />

      <LandingMotion />
    </>
  );
}
