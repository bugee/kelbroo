# kelbroo — Specyfikacja produktowa

> Status: draft v0.1 · 2026-08-22
> Ten dokument jest nadrzędną specyfikacją produktu. Szczegóły techniczne każdego z trzech systemów znajdują się w osobnych plikach: [architecture.md](architecture.md), [01-landing-marketing.md](01-landing-marketing.md), [02-admin-panel.md](02-admin-panel.md), [03-customer-ordering.md](03-customer-ordering.md).

## 1. Wizja produktu

kelbroo to platforma SaaS dla restauracji, która zastępuje tradycyjne menu papierowe i ręczną obsługę zamówień cyfrowym doświadczeniem "zeskanuj i zamów". Gość restauracji skanuje kod QR przy stoliku, przegląda menu we własnym języku, składa zamówienie, płaci i śledzi jego status — bez pobierania aplikacji i bez zakładania konta. Zamówienie trafia natychmiast do panelu obsługi (kuchnia + kelnerzy), co skraca czas oczekiwania i eliminuje błędy przy przepisywaniu zamówień.

Rynek startowy: **Polska**, z architekturą przygotowaną pod ekspansję zagraniczną (wielowalutowość, wielojęzyczność, wymienny provider płatności).

## 2. Trzy komponenty produktu

| # | Komponent | Użytkownik | Skrót |
|---|---|---|---|
| 1 | **Strona produktowa / marketing** | Właściciele restauracji (leady) | Prezentacja oferty, cennik, zakup abonamentu, onboarding |
| 2 | **Panel zarządzania (Admin/Back-office)** | Właściciel, manager, kelner, kuchnia | Zarządzanie subskrypcją, restauracją, stolikami/QR, menu (wielojęzyczne), realizacja zamówień |
| 3 | **Aplikacja zamawiania dla gości** | Klient restauracji | Skan QR → menu → zamówienie → płatność → ocena/feedback |

Szczegółowe specyfikacje: [01-landing-marketing.md](01-landing-marketing.md) · [02-admin-panel.md](02-admin-panel.md) · [03-customer-ordering.md](03-customer-ordering.md).

## 3. Persony

- **Właściciel/Manager restauracji** — kupuje abonament, konfiguruje restaurację, stoliki, menu, personel; śledzi sprzedaż i feedback. Zależy mu na prostocie wdrożenia i szybkim zwrocie z inwestycji.
- **Kelner** — obsługuje panel realizacji zamówień na tablecie, widzi które zamówienia są gotowe do dostarczenia, oznacza stoliki jako obsłużone, reaguje na przywołania gości.
- **Kucharz / kuchnia** — widzi kolejkę zamówień na ekranie kuchennym (KDS), oznacza postęp przygotowania dań.
- **Gość restauracji (klient)** — skanuje QR, zamawia i płaci bez rejestracji; oczekuje szybkości, przejrzystości cen i możliwości oceny dań.
- **Administrator platformy kelbroo** — zespół wsparcia/operacji, zarządza kontami klientów SaaS, monitoruje płatności subskrypcyjne, wspiera onboarding.

## 4. Kluczowa podróż użytkownika (end-to-end)

1. Właściciel restauracji trafia na stronę produktową, wybiera plan i kupuje abonament (rejestracja + płatność cykliczna).
2. W panelu admina przechodzi onboarding: dane restauracji, dodanie lokalu, stolików, generowanie kodów QR do wydruku, utworzenie menu (kategorie, dania, tłumaczenia), zaproszenie personelu.
3. Restauracja drukuje/umieszcza kody QR na stolikach.
4. Gość siada przy stoliku, skanuje QR → otwiera się PWA z menu w wykrytym/wybranym języku.
5. Gość przegląda menu, dodaje dania do koszyka i składa zamówienie. W zależności od trybu ustawionego przez restaurację (§5.6): **płaci od razu** (BLIK/karta/Apple Pay/Google Pay, opcjonalnie z napiwkiem) albo zamówienie idzie **na rachunek stolika** do rozliczenia u kelnera po konsumpcji.
6. Jeśli restauracja wymaga potwierdzenia, zamówienie czeka w kolejce kelnera; w przeciwnym razie trafia natychmiast do panelu kuchni (KDS).
7. Kuchnia oznacza postęp przygotowania; kelner widzi gotowe zamówienie i dostarcza je do stolika, oznaczając je jako wydane.
8. Gość może dołożyć kolejne zamówienie w trakcie wizyty (kolejna "runda") — wszystkie dokładają się do tego samego rachunku stolika.
9. Zakończenie wizyty: w trybie `prepaid` rachunek jest już opłacony; w trybie `pay_at_table` gość prosi o rachunek, a kelner rozlicza go na kasie lokalu i zamyka wizytę w panelu.
10. Po posiłku gość ocenia dania i zostawia feedback — trafia on do managera i kuchni w panelu analityki.
11. Manager przegląda sprzedaż, popularność dań i oceny w panelu raportów.

Szczegółowy diagram sekwencji: patrz [architecture.md §6](architecture.md#6-przepływ-zamówienia-sequence).

## 5. Model biznesowy i cennik

- **Model rozliczeń:** stały **abonament miesięczny/roczny** pobierany od restauracji (właściciela), **bez prowizji od pojedynczych zamówień gości**.
- **Jednostka rozliczeniowa:** lokal (Restaurant/Location). Właściciel z wieloma lokalami płaci za każdy lokal osobno, z rabatem ilościowym.
- **Waluta i ceny:** wszystkie ceny **netto w PLN** (do kwot doliczany VAT 23%).

### 5.1 Plany

| | **Menu** | **Starter** | **Pro** | **Enterprise** |
|---|---|---|---|---|
| **Dla kogo** | Lokal chcący tylko cyfrowe menu | Kawiarnia, mały lokal, food truck | Restauracja z pełną obsługą | Sieć, hotel, food court |
| **Cena miesięcznie** | **0 zł** | **159 zł** | **349 zł** | **od 899 zł** |
| **Cena rocznie** (za mies.) | 0 zł | **132 zł** (1 590 zł/rok) | **291 zł** (3 490 zł/rok) | indywidualnie |
| Stoliki / kody QR | bez limitu | do 12 | do 40 | bez limitu |
| Języki menu | 1 | 2 | 6 | bez limitu |
| Pozycje w menu | do 50 | bez limitu | bez limitu | bez limitu |
| Cyfrowe menu + QR | ✅ | ✅ | ✅ | ✅ |
| Zamawianie do stolika | ❌ | ✅ | ✅ | ✅ |
| Płatność u kelnera (tryb bez płatności online) | — | ✅ | ✅ | ✅ |
| Płatność w aplikacji (BLIK/karta/Apple/Google Pay) | ❌ | ✅ | ✅ | ✅ |
| Panel kuchni (KDS) + panel kelnera | ❌ | ✅ | ✅ | ✅ |
| Konta personelu | 1 | 3 | bez limitu | bez limitu |
| Oceny dań i feedback do managera | ❌ | podstawowe | ✅ pełne | ✅ pełne |
| Analityka i raporty | ❌ | podstawowy pulpit | ✅ pełna + eksport | ✅ + API raportowe |
| Podział rachunku | ❌ | „każdy za siebie” | ✅ pełny (po pozycjach, grupami, po równo) | ✅ pełny |
| Wiele lokali w jednej organizacji | ❌ | ❌ | ❌ | ✅ |
| Integracja z kasą fiskalną / POS | ❌ | ❌ | dodatek płatny | ✅ w cenie |
| Własny branding (logo, kolory) | z belką kelbroo | ✅ | ✅ | ✅ + własna domena |
| Wsparcie | e-mail | e-mail (24h) | priorytetowe (4h) | opiekun klienta + SLA 99,9% |

**Plan Menu (0 zł)** to kanał pozyskiwania klientów, nie produkt docelowy: lokal dostaje działające cyfrowe menu z kodami QR i po kilku tygodniach ma naturalny powód, by przejść na Starter (zamawianie). Utrzymanie takiego konta jest tanie — brak zamówień, brak realtime, brak płatności.

### 5.2 Dodatki płatne (add-ony)

| Dodatek | Cena | Dostępny w |
|---|---|---|
| Pakiet +10 stolików | 49 zł/mies | Starter, Pro |
| Dodatkowy język ponad limit | 39 zł/mies | Starter, Pro |
| Integracja z kasą fiskalną / POS lokalu | 149 zł/mies | Pro (w Enterprise w cenie) |
| Fiskalizacja w chmurze (kasa wirtualna) | 99 zł/mies + opłaty operatora | Pro, Enterprise |
| Wdrożenie „pod klucz" (wprowadzenie menu, zdjęcia dań, wydruk i montaż QR) | 990 zł jednorazowo | wszystkie |
| Sesja zdjęciowa menu | wycena indywidualna | wszystkie |

### 5.3 Rabaty

- **Płatność roczna:** −17% (2 miesiące gratis).
- **Sieci:** 3–9 lokali −15%, 10+ lokali −25% (naliczane od sumy abonamentów).
- **Program poleceń:** miesiąc gratis dla polecającego i poleconego.

### 5.4 Opłaty transakcyjne

- **kelbroo nie pobiera żadnej prowizji od zamówień.**
- Przy płatnościach w aplikacji obowiązują standardowe opłaty operatora płatności (orientacyjnie: BLIK ~1,3%, karta ~1,4% + 0,50 zł), rozliczane **bezpośrednio między restauracją a operatorem** — kelbroo nie pośredniczy w przepływie pieniędzy.
- **W trybie „płatność u kelnera" (§5.6) nie występują żadne opłaty transakcyjne** — to istotny argument sprzedażowy dla lokali o niskiej marży.

### 5.5 Okres próbny i rozliczenia

- **Trial 14 dni** planu Pro, bez podawania karty. Po zakończeniu konto schodzi automatycznie do planu Menu (dane zachowane), chyba że klient wykupi abonament.
- Płatność cykliczna kartą (Stripe Billing), faktury VAT generowane automatycznie.
- Zmiana planu: upgrade natychmiast (proporcjonalne doliczenie), downgrade od kolejnego okresu.
- Brak umowy na czas określony — rezygnacja w dowolnym momencie, do końca opłaconego okresu.

### 5.6 Tryby zamawiania i płatności (wybór restauracji)

Restauracja decyduje, w jakim modelu działa jej lokal. To ustawienie konfigurowalne w panelu, nie osobny produkt.

| Tryb | Jak działa | Dla kogo |
|---|---|---|
| **`prepaid`** — płatność z góry w aplikacji | Gość płaci przy składaniu zamówienia; do kuchni trafia dopiero po potwierdzeniu płatności | Lokale szybkiej obsługi, bary, food court, ogródki — gdzie ryzyko „gość wychodzi bez płacenia" jest realne |
| **`pay_at_table`** — płatność wyłącznie u kelnera | **Brak jakiejkolwiek płatności w aplikacji.** Gość tylko zamawia z menu do stolika; wszystkie zamówienia z wizyty sumują się w jeden rachunek, który kelner rozlicza po konsumpcji na własnej kasie/terminalu | Restauracje z pełną obsługą kelnerską, lokale które nie chcą zmieniać obiegu płatności ani fiskalizacji |
| **`guest_choice`** — gość wybiera | Przy składaniu zamówienia gość decyduje: zapłacić teraz czy przy wyjściu u kelnera | Lokale mieszane — obiady biznesowe vs. szybka kawa |

**Niezależne ustawienie: potwierdzenie zamówienia przez obsługę** (`require_staff_confirmation`).
Gdy włączone, zamówienie gościa nie trafia od razu do kuchni, tylko na ekran „Powiadomienia" w panelu kelnera. Kelner podchodzi do stolika, weryfikuje zamówienie i zatwierdza. Dopiero wtedy idzie na kuchnię.

- Domyślnie **włączone** dla `pay_at_table` (nie ma płatności, więc potwierdzenie obsługi jest zabezpieczeniem przed fałszywymi zamówieniami).
- Domyślnie **wyłączone** dla `prepaid` (płatność już potwierdziła intencję gościa).
- Restauracja może to zmienić w obie strony — niektóre lokale kelnerskie chcą pełnej automatyzacji, niektóre lokale prepaid chcą kontroli nad każdym zamówieniem.

**Konsekwencja architektoniczna:** rachunek jest przypięty do **wizyty przy stoliku**, a nie do pojedynczego zamówienia. Gość może w trakcie posiłku złożyć trzy zamówienia (przystawka, danie główne, deser) — to jeden rachunek, rozliczany raz. Szczegóły modelu: [architecture.md §4](architecture.md#4-model-danych-kluczowe-encje) i [§6](architecture.md#6-przepływ-zamówienia-sequence).

### 5.7 Podział rachunku

Goście przy jednym stoliku rzadko chcą jednego rachunku. Każda osoba skanuje ten sam kod QR, dołącza do wizyty jako **uczestnik** (nick wybrany lub wylosowany + awatar, bez zakładania konta) i może rozliczyć się osobno albo w grupie.

| Tryb podziału | Opis |
|---|---|
| Jeden rachunek | Domyślny — para, rodzina |
| Każdy za siebie | Każdy płaci za pozycje przypisane do siebie |
| Po pozycjach | Ręczne przypisanie dań do osób, z dzieleniem wspólnych pozycji (butelka wina na trzy części) |
| Po równo | Suma dzielona przez liczbę osób |
| Grupami | Uczestnicy łączeni w grupy płatnicze („dwie pary, dwa rachunki”) |
| Jedna osoba płaci za wszystkich | Gospodarz reguluje całość, a zestawienie „kto co zamówił” idzie na e-mail |

Zależność od trybu płatności:

- **W trybie `prepaid` podział jest wbudowany i domyślny: każdy płaci za siebie** — uczestnik składa i opłaca własne zamówienie ze swojego telefonu, więc nie ma czego dzielić po fakcie. Nie pokazujemy wtedy żadnego ekranu podziału.
- **W trybie `pay_at_table`** dostępne są wszystkie tryby podziału, wybierane przy prośbie o rachunek; kelner przyjmuje płatność od każdej osoby lub grupy osobno.

Scenariusz „jedna osoba płaci za wszystkich” obsługuje kolacje służbowe i spotkania rodzinne: gospodarz reguluje cały rachunek, a następnie każdy uczestnik (albo sam gospodarz) może wysłać sobie na e-mail **zestawienie z rozbiciem na osoby** — do rozliczenia delegacji lub zwrotu kosztów między znajomymi. E-mail podawany jest doraźnie, bez zakładania konta; dokument jest informacyjny, nie fiskalny.

Szczegóły modelu i arytmetyki (zaokrąglenia, niezmienniki sum): [architecture.md §14](architecture.md#14-podział-rachunku).

### 5.8 Zamówienia i korekty po stronie obsługi

Kelner musi móc złożyć zamówienie w imieniu gościa (gość woli zamówić ustnie, nie ma telefonu, nie radzi sobie z aplikacją) oraz poprawić zamówienie już złożone. Wymóg nadrzędny: **w każdym momencie musi być widoczne, co dodał gość, a co obsługa** — to podstawa rozliczenia kelnera i rozstrzygania sporów o rachunek. Każda zmiana trafia do niemodyfikowalnej historii zamówienia. Szczegóły: [architecture.md §13](architecture.md#13-atrybucja-i-edycja-zamówień).

**Konsekwencja wdrożeniowa:** tryb `pay_at_table` **całkowicie omija problem fiskalizacji** — restauracja wystawia paragon na swojej istniejącej kasie, tak jak dotychczas. To najszybsza ścieżka do pierwszego wdrożenia produkcyjnego (patrz [architecture.md §12](architecture.md#12-fiskalizacja-i-paragony-polska)).

## 6. Zakres MVP vs. Faza 2

**MVP — etap 1 (pierwsze wdrożenie produkcyjne, tryb `pay_at_table`):**

Świadomie startujemy od trybu **bez płatności online**. Eliminuje to z pierwszego wydania zarówno integrację płatniczą, jak i fiskalizację — czyli dwie najbardziej ryzykowne i najdłuższe zależności. Produkt daje realną wartość (cyfrowe menu wielojęzyczne + zamawianie do stolika + KDS) już w tym kształcie i można go wdrożyć u pilotażowego klienta w kilka tygodni.

- System 1: strona z cennikiem, rejestracja, zakup abonamentu (Starter + Pro wystarczą na start).
- System 2: 1 lokal, stoliki + generowanie QR, menu w min. 2 językach, role Manager/Kelner/Kuchnia, panel realizacji zamówień + ekran „Powiadomienia", **składanie i edycja zamówień przez kelnera z pełną historią zmian**, rachunek stolika z podziałem (każdy za siebie / po równo / grupami) i jego zamykanie przez kelnera.
- System 3: PWA — menu, koszyk, **uczestnicy wizyty (nick + awatar)**, zamówienie na rachunek stolika, status zamówienia live, prośba o rachunek z wyborem podziału, zestawienie na e-mail, ocena dania po posiłku.

**MVP — etap 2 (płatności online):**
- Tryby `prepaid` i `guest_choice`, integracja BLIK/karta/Apple Pay/Google Pay, napiwki.
- Podział „po pozycjach" z dzieleniem pojedynczej pozycji między uczestników (`OrderItemShare`) — najbardziej złożona arytmetycznie część podziału, świadomie odłożona za etap 1.
- Rozwiązanie fiskalizacji (decyzja: integracja z kasą lokalu lub kasa wirtualna — [architecture.md §12](architecture.md#12-fiskalizacja-i-paragony-polska)).

**Faza 2:**
- Wiele lokali pod jedną organizacją (sieci restauracji).
- Natywne aplikacje mobilne (iOS/Android) dla gości — historia zamówień, ulubione, powiadomienia push, program lojalnościowy.
- Zaawansowana analityka i eksport raportów, integracje z kasami fiskalnymi/POS.
- Automatyczne tłumaczenie menu wspomagane AI z edycją manualną.
- Wielowalutowość i wielorynkowość (ekspansja poza Polskę).

## 7. Wymagania niefunkcjonalne (dotyczą wszystkich trzech systemów)

- **Wydajność:** menu gościa musi się załadować w < 2s na 4G; aktualizacje statusu zamówienia w czasie rzeczywistym (< 3s opóźnienia) między panelem obsługi a apką gościa.
- **Dostępność (uptime):** cel 99.9% dla ścieżki zamawiania i płatności (krytyczna dla przychodu restauracji).
- **Wielojęzyczność:** UI i treść menu tłumaczalne; system musi wspierać dodawanie nowych języków bez zmian w kodzie (słowniki/CMS treści).
- **Wielowalutowość:** waluta i stawki VAT konfigurowalne per restauracja/kraj (przygotowanie pod ekspansję).
- **Zgodność prawna (Polska):** RODO (minimalizacja danych gościa — brak wymaganej rejestracji), fiskalizacja sprzedaży (integracja z kasą/drukarką fiskalną lub certyfikowanym API fiskalizacji), przechowywanie danych płatniczych zgodnie z PCI DSS (poprzez tokenizację u dostawcy płatności — platforma nigdy nie przechowuje danych karty).
- **Dostępność cyfrowa (accessibility):** aplikacja gościa zgodna z WCAG 2.1 AA — używana przez szeroką, przypadkową publiczność.
- **Odporność sieciowa:** panel obsługi na tablecie musi buforować akcje offline i synchronizować po powrocie sieci (typowe dla wi-fi w lokalach gastronomicznych).
- **Bezpieczeństwo wielodostępowości (multi-tenancy):** pełna izolacja danych między restauracjami (różni klienci SaaS nie widzą nawzajem swoich danych).

## 8. Metryki sukcesu (KPI)

- **Biznes kelbroo:** liczba aktywnych restauracji (MRR), churn miesięczny, konwersja trial → płatny plan.
- **Restauracja (wartość dla klienta B2B):** średni czas od złożenia zamówienia do dostarczenia, wzrost średniej wartości zamówienia (upsell przez menu cyfrowe), % zamówień z napiwkiem.
- **Gość (UX):** czas od skanu QR do złożenia pierwszego zamówienia, % zamówień zakończonych oceną dania, NPS/feedback ogólny.

## 9. Otwarte pytania / decyzje do podjęcia

- **Walidacja cennika** — ceny z §5.1 to propozycja wyjściowa oparta na pozycjonowaniu wobec konkurencji na rynku PL. Wymaga potwierdzenia rozmowami z 5–10 restauratorami przed publikacją.
- **Czy plan Menu (0 zł) faktycznie wchodzi do oferty** — silny kanał pozyskania, ale obciąża wsparcie i rozmywa przekaz. Alternatywa: 49 zł/mies zamiast darmowego.
- **Wybór ścieżki fiskalizacji** dla etapu 2 — trzy opcje opisane w [architecture.md §12](architecture.md#12-fiskalizacja-i-paragony-polska); decyzja wymaga konsultacji z doradcą podatkowym.
- Zakres programu lojalnościowego w natywnej aplikacji gościa (faza 2).
- Czy restauracje mogą podłączyć własną bramkę płatności, czy kelbroo narzuca jednego dostawcę.
- Czy w trybie `pay_at_table` udostępniać gościowi podgląd bieżącego rachunku stolika (ryzyko: goście przy jednym stoliku widzą nawzajem swoje zamówienia).
