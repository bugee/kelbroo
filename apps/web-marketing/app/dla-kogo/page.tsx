import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Dla kogo jest kelbroo — restauracje, kawiarnie, bary, hotele, sieci',
  description:
    'Co zmienia zamawianie z telefonu w restauracji z pełną obsługą, w kawiarni, ' +
    'w barze, w hotelu i w sieci lokali.',
};

interface Segment {
  id: string;
  nazwa: string;
  /** Zdanie, które ma w kimś kliknąć: „to jest o mnie". */
  kogo: string;
  /** Najczęstsza obiekcja tego segmentu, nazwana wprost. */
  obiekcja: { pytanie: string; odpowiedz: string };
  korzysci: { tytul: string; opis: string }[];
  cta: { etykieta: string; href: string };
}

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
 */
const SEGMENTY: Segment[] = [
  {
    id: 'restauracje',
    nazwa: 'Restauracje z pełną obsługą',
    kogo: 'Kelnerzy przy stolikach, karta z kilkunastoma daniami, wieczory z pełną salą.',
    obiekcja: {
      pytanie: 'Czy to znaczy, że muszę zmienić sposób przyjmowania płatności?',
      odpowiedz:
        'Nie. Możesz zostawić dokładnie ten obieg, który masz: gość zamawia z telefonu, ' +
        'a płaci kelnerowi po posiłku — na Twoim terminalu i Twojej kasie fiskalnej. ' +
        'W tym trybie nie ma żadnych opłat transakcyjnych, płacisz wyłącznie abonament.',
    },
    korzysci: [
      {
        tytul: 'Kelner przestaje biegać po zamówienia',
        opis:
          'Zamówienie idzie ze stolika prosto na ekran kuchni. Obsługa zostaje przy tym, ' +
          'za co goście naprawdę doceniają lokal: doradzaniu i dopilnowaniu stolika.',
      },
      {
        tytul: 'Możesz zatwierdzać każde zamówienie',
        opis:
          'Jeśli wolisz, żeby nic nie trafiało na kuchnię bez kelnera, włącz potwierdzanie ' +
          'przy stoliku. Zamówienie czeka w kolejce, dopóki obsługa go nie przyjmie.',
      },
      {
        tytul: 'Jeden rachunek na stolik, nawet gdy telefonów jest sześć',
        opis:
          'Wszyscy przy stoliku dokładają do wspólnego rachunku i widzą, kto co zamówił. ' +
          'Na koniec dzielicie go po osobach, po pozycjach albo po równo.',
      },
    ],
    cta: { etykieta: 'Zobacz to oczami gościa', href: '/#demo' },
  },
  {
    id: 'kawiarnie',
    nazwa: 'Kawiarnie i lokale przy ladzie',
    kogo: 'Szybki obrót, kolejka do lady, dwie osoby na zmianie.',
    obiekcja: {
      pytanie: 'Mam małą kartę i dwie osoby na zmianie — czy to nie za duży system?',
      odpowiedz:
        'Konfiguracja to jeden dzień: wpisujesz kartę, drukujesz kody QR i tyle. ' +
        'Plan Starter kosztuje 159 zł netto miesięcznie i obejmuje do 12 stolików. ' +
        'Możesz też zacząć od samego cyfrowego menu, bez zamawiania.',
    },
    korzysci: [
      {
        tytul: 'Gość zamawia od stolika, nie z kolejki',
        opis:
          'Kolejka do lady przestaje być wąskim gardłem w godzinach szczytu — a osoba ' +
          'przy ekspresie nie przerywa co chwilę, żeby przyjąć zamówienie.',
      },
      {
        tytul: 'Zmiana karty zajmuje minutę',
        opis:
          'Ciasto się skończyło? Wyłączasz pozycję w panelu i znika z menu wszystkich ' +
          'gości od razu. Bez przedrukowywania czegokolwiek.',
      },
      {
        tytul: 'Kody QR drukujesz sam',
        opis: 'Panel generuje arkusz do wydrukowania na zwykłej drukarce. Bez zamawiania i czekania.',
      },
    ],
    cta: { etykieta: 'Zobacz cennik', href: '/#cennik' },
  },
  {
    id: 'bary',
    nazwa: 'Bary i puby',
    kogo: 'Głośne wieczory, dużo dokładek, rachunki dzielone na końcu.',
    obiekcja: {
      pytanie: 'U mnie wieczorem nikt nie będzie się bawił w telefon.',
      odpowiedz:
        'Zwykle jest odwrotnie: przy głośnej muzyce przekrzykiwanie zamówienia to ' +
        'największa uciążliwość wieczoru. Kolejna kolejka idzie jednym stuknięciem, ' +
        'a kelner nie musi wracać po nic dwa razy.',
    },
    korzysci: [
      {
        tytul: 'Dokładka bez szukania obsługi',
        opis:
          'To samo, co ostatnio, jednym stuknięciem — a wezwanie kelnera zajmuje ' +
          'jedno kliknięcie i widać, że kelner już idzie.',
      },
      {
        tytul: 'Rachunek dzieli się sam',
        opis:
          'Na koniec wieczoru każdy widzi, co zamawiał. Podział po pozycjach, po osobach ' +
          'albo po równo — bez liczenia na serwetce.',
      },
      {
        tytul: 'Limit otwartego rachunku',
        opis:
          'Ustawiasz kwotę, po której stolik musi się rozliczyć, zanim zamówi więcej. ' +
          'Wieczór nie kończy się niespodzianką.',
      },
    ],
    cta: { etykieta: 'Zobacz to oczami gościa', href: '/#demo' },
  },
  {
    id: 'hotele',
    nazwa: 'Hotele',
    kogo: 'Śniadania, restauracja hotelowa, goście mówiący w kilku językach.',
    obiekcja: {
      pytanie: 'Połowa moich gości nie mówi po polsku.',
      odpowiedz:
        'Menu prowadzisz w kilku językach naraz, a gość dostaje swój po ustawieniu ' +
        'telefonu. Brak tłumaczenia nigdy nie daje pustego ekranu — pokazujemy wtedy ' +
        'wersję w języku domyślnym lokalu.',
    },
    korzysci: [
      {
        tytul: 'Menu wielojęzyczne bez osobnych kart',
        opis:
          'Jedna karta, kilka wersji językowych. Zmiana ceny w jednym miejscu przechodzi ' +
          'na wszystkie języki.',
      },
      {
        tytul: 'Alergeny i składy przy każdej pozycji',
        opis: 'Gość sprawdza je sam, bez pytania obsługi i bez tłumaczenia przez recepcję.',
      },
      {
        tytul: 'Kody QR wszędzie tam, gdzie jest stolik',
        opis:
          'Restauracja, lobby, taras. Każdy stolik ma własny kod, więc zamówienie ' +
          'od razu wiadomo, dokąd zanieść.',
      },
    ],
    cta: { etykieta: 'Umów prezentację', href: '/#prezentacja' },
  },
  {
    id: 'sieci',
    nazwa: 'Sieci i food courty',
    kogo: 'Kilka lokali pod jedną marką, wspólne raportowanie, własne procedury.',
    obiekcja: {
      pytanie: 'Mamy własny system POS i procedury, których nie będziemy zmieniać.',
      odpowiedz:
        'Rozmawiamy o tym przed wdrożeniem, nie po. Wdrożenia dla sieci prowadzimy ' +
        'indywidualnie — z integracją po Waszej stronie, wspólnym cennikiem i osobnym ' +
        'opiekunem. Plan Enterprise zaczyna się od 899 zł netto i jest wyceniany do zakresu.',
    },
    korzysci: [
      {
        tytul: 'Wdrożenie prowadzone przez człowieka',
        opis:
          'Wprowadzenie karty, wydruk i montaż kodów, szkolenie obsługi. Nie zostawiamy ' +
          'sieci z panelem i instrukcją.',
      },
      {
        tytul: 'Jedna karta, wiele lokali',
        opis:
          'Zakres i sposób podziału ustalamy przy wdrożeniu — inaczej wygląda to ' +
          'w food courcie, a inaczej w sieci z jednym menu na wszystkie punkty.',
      },
      {
        tytul: 'Rozmowa przed podpisem',
        opis:
          'Pokazujemy panel na żywo i przechodzimy przez Wasz scenariusz, zanim ' +
          'cokolwiek zamawiacie.',
      },
    ],
    cta: { etykieta: 'Umów prezentację', href: '/#prezentacja' },
  },
];

export default function SegmentyPage() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <h2>Dla kogo jest kelbroo</h2>
              <p>
                Ten sam produkt rozwiązuje w każdym lokalu inny problem. Poniżej pięć sytuacji, w
                których widzieliśmy go w działaniu — z obiekcją, którą słyszymy w każdej z nich
                najczęściej.
              </p>
            </div>

            <nav
              aria-label="Rodzaje lokali"
              style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
            >
              {SEGMENTY.map((segment) => (
                <a key={segment.id} className="btn btn-ghost btn-sm" href={`#${segment.id}`}>
                  {segment.nazwa}
                </a>
              ))}
            </nav>
          </div>
        </section>

        {SEGMENTY.map((segment) => (
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
                {/* Cudzysłów polski: otwierający na dole, zamykający na górze. */}
                <h3 style={{ margin: '0 0 10px' }}>„{segment.obiekcja.pytanie}”</h3>
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
                <a className="btn btn-primary" href={segment.cta.href}>
                  {segment.cta.etykieta}
                </a>
              </p>
            </div>
          </section>
        ))}

        <section className="section">
          <div className="wrap">
            <div className="cta-band">
              <h2>Nie ma tu Twojego lokalu?</h2>
              <p>
                Napisz, jak u Ciebie wygląda przyjmowanie zamówień. Powiemy wprost, czy kelbroo coś
                zmieni, czy nie warto.
              </p>
              <div className="cta-actions">
                <a className="btn btn-primary" href="/#kontakt">
                  Napisz do nas
                </a>
                <a className="btn btn-ghost" href="/rejestracja">
                  Zacznij za darmo
                </a>
              </div>
              <p className="cta-fine">14 dni planu Pro bez opłat i bez podawania karty</p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
