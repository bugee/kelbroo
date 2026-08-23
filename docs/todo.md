# Plan realizacji — MVP etap 1

Żywa lista zadań. Zakres pochodzi z [product.md §6](product.md#6-zakres-mvp-vs-faza-2):
tryb `pay_at_table`, bez płatności online i bez fiskalizacji.

**Jak z niej korzystać:** `[ ]` do zrobienia, `[x]` zrobione, `[~]` w trakcie.
Zadania są ułożone w kolejności realizacji — wcześniejsze odblokowują późniejsze.
Listę aktualizuję na bieżąco przy każdej zmianie w projekcie.

*Ostatnia aktualizacja: 2026-08-23*

---

## Stan na dziś

Działa produkcyjnie: API, panel obsługi i PWA gościa na `kelbroo.com`, z HTTPS,
migracjami i izolacją danych przez RLS. **Pełna ścieżka przeszła na produkcji** —
skan QR, menu, koszyk, zamówienie, kolejka potwierdzeń, KDS, rozliczenie stolika.
Kody QR drukują się, backupy bazy są ustawione.

Ścieżka gościa jest potwierdzona **ręcznie, jednorazowo** — nie pilnuje jej żaden test.
Pokrycie e2e tej drogi jest w sekcji 6 i to jest teraz najkrótsza droga do tego, żeby
regresja nie wróciła niezauważona.

Czego brakuje do pełnego zakresu etapu 1: **Systemu 1 w całości** (rejestracja i abonament),
**podziału rachunku**, **zamawiania przez kelnera**, oraz czterech funkcji gościa,
których modele istnieją w bazie, ale nie ma do nich ani linii kodu — `SettlementGroup`,
`Review`, `WaiterCall`, `OrderItemShare`.

**Najbliższa blokada: sekcja 4.** Ekran gościa działa już na żywo — status zamówienia,
stan wezwania i wpuszczenie do stolika zmieniają się same. Zostają cztery rzeczy: ocena
dania, zestawienie na e-mail, wybór nicku oraz zmiana hosta wizyty. Do tego powrót
do wizyty bez ponownego skanowania.

---

## 4. Pozostałe funkcje gościa (System 3)

Modele są w schemacie od pierwszej migracji i nie mają ani jednego odwołania w kodzie.

- [ ] **Ocena dania po posiłku** (`Review`).
- [ ] **Zestawienie rachunku na e-mail** — poczta przez SMTP Hostingera, nadawca
      `kontakt@kelbroo.com`. W projekcie nie ma jeszcze żadnej wysyłki, więc najpierw
      abstrakcja dostawcy, dopiero potem treść wiadomości.
- [ ] **Wybór nicku przez gościa** — dziś losowany; zakres etapu 1 mówi o wpisaniu
      lub wylosowaniu.
- [ ] **Powrót do wizyty bez ponownego skanowania** — gość zamyka kartę albo przeglądarkę
      i wraca na `menu.kelbroo.com` z historii. Dziś widzi tam statyczne „Zeskanuj kod QR",
      więc musi fizycznie znaleźć kod na stoliku, mimo że jego wizyta trwa.

      **Połowa tego już działa:** token gościa leży w `localStorage` pod kluczem
      `kelbroo.guest.{qrToken}`, a `enterTable` wysyła go przy wejściu — serwer odzyskuje
      wtedy uczestnika i historię (`reuseGuestSession` w `table.service.ts`). Brakuje
      **strony startowej, która to wykorzysta**: sprawdzi zapamiętaną wizytę i przerzuci
      gościa prosto do menu, jeśli rachunek nie jest jeszcze zamknięty.

      Do rozstrzygnięcia przy realizacji:
      - **ciasteczko zamiast (albo obok) `localStorage`** — ciasteczko czyta serwer, więc
        przekierowanie dzieje się przed wyrenderowaniem strony, bez migotania. Techniczne,
        niezbędne do działania usługi, więc nie wymaga banera zgody; trzeba je opisać
        w polityce prywatności (§5c).
      - **wygasanie** — sesja gościa żyje `GUEST_SESSION_TTL_HOURS` (domyślnie 6 h),
        a wizyta kończy się zamknięciem rachunku. Powrót po zamkniętym rachunku ma
        prowadzić do ekranu „Zeskanuj kod QR", nie do cudzego stolika.
      - **kilka stolików** — klucz jest per kod QR, więc przesiadka to inna wizyta.
        Strona startowa musi wybrać tę właściwą, nie pierwszą z brzegu.
      - **okno prywatne i wyczyszczone dane** — pamięci wtedy nie ma i ścieżka ma
        po cichu wrócić do skanowania, a nie pokazać błąd.
- [ ] **Zmiana hosta wizyty** — dwa wejścia: host wskazuje następcę spośród uczestników,
      a kelner może go zmienić z panelu. Dziś hostem zostaje na stałe pierwszy skanujący,
      co psuje się, gdy wychodzi wcześniej albo skanował ktoś przypadkowy.

      **Część już działa:** rola przechodzi automatycznie na kolejnego uczestnika, gdy
      host zostanie usunięty ze stolika, a przy pustym stoliku hostem zostaje następny
      skanujący. Brakuje świadomego wskazania następcy — dziś decyduje kolejność wejścia.
      Waga tego rośnie z włączonym `host_approves_guests`: host jest wtedy nie tylko
      płatnikiem, ale i bramkarzem.
      Host jest domyślnym płatnikiem i to do niego trafia nierozdzielony grosz przy
      podziale, więc pomyłka zostaje na rachunku.

## 5. System 1 — strona produktowa i sprzedaż

Pod `kelbroo.com` stoi statyczny [design/landing-page.html](../design/landing-page.html)
serwowany przez Caddy. Strona wygląda na gotową, ale **12 z 20 odnośników nie ma celu** —
klikając cokolwiek poza nawigacją i logowaniem, użytkownik zostaje na miejscu.
Poniższe zadania to dokładnie ta lista braków.

### 5a. Rejestracja i okres próbny

Sekcja `#trial` obiecuje wprost: *„14 dni planu Pro bez opłat i bez podawania karty"*.
Nie stoi za tym żaden formularz ani endpoint — przycisk **„Zacznij za darmo"** prowadzi
do `#rejestracja`, którego nie ma.

- [ ] **Formularz rejestracji** (`#rejestracja`) — dane restauracji, e-mail właściciela, hasło.
- [ ] **Endpoint zakładający konto** — `Organization` + `Restaurant` + `StaffMember(owner)`
      + `Subscription`, w jednej transakcji, bez udziału administratora.
- [ ] **Okres próbny 14 dni** — `status = trialing`, `currentPeriodEnd = teraz + 14 dni`.
      Schemat już to obsługuje, migracja niepotrzebna.
- [ ] **Weryfikacja adresu e-mail** — zależy od dostawcy poczty (sekcja 4, ta sama blokada
      co zestawienie rachunku).
- [ ] **Wygaśnięcie abonamentu wyłącza zamawianie**, ale nigdy nie kasuje danych restauracji.
- [ ] **Zakup abonamentu Starter i Pro** — pole `stripeSubscriptionId` czeka w schemacie.
- [ ] **Podpiąć CTA do rejestracji** — „Zacznij 14 dni za darmo", „Załóż konto",
      „Wybierz Starter", „Testuj 14 dni" prowadzą dziś tylko do sekcji z opisem.

### 5b. Kontakt i prezentacja

Sekcja `#kontakt` nie istnieje, a wskazują na nią **trzy** przyciski: „Porozmawiajmy",
„Umów prezentację" i „Kontakt" w stopce.

- [ ] **Sekcja lub podstrona kontaktowa** (`#kontakt`).
- [ ] **„Umów prezentację"** — formularz z terminem i danymi kontaktowymi; to główne CTA
      dla większych lokali i sieci, które nie założą konta samodzielnie.
- [ ] **Dane firmy** — nazwa, adres, NIP, e-mail. Przy sprzedaży B2B to wymóg, nie ozdobnik.

### 5c. Treści prawne w stopce

Trzy odnośniki w stopce prowadzą donikąd. **Bez tych dokumentów strona zbierająca
rejestracje jest niezgodna z prawem** — to blokuje uruchomienie 5a, nie tylko estetykę.

- [ ] **Regulamin** (`#regulamin`) — warunki świadczenia usługi, abonament, wypowiedzenie.
- [ ] **Polityka prywatności** (`#prywatnosc`) — jakie dane, po co, jak długo, komu powierzane.
      Musi objąć też dane gości: nick, awatar i zamówienie, mimo braku rejestracji.
- [ ] **Informacja RODO** (`#rodo`) — administrator, podstawa prawna, prawa osoby,
      dane kontaktowe do zgłoszeń.
- [ ] **Zgody przy rejestracji** — checkboxy akceptacji regulaminu i polityki, z datą zgody.

> Te trzy dokumenty wymagają prawnika. Szablon z internetu nie obroni się przy kontroli,
> a przy modelu SaaS dochodzi powierzenie przetwarzania danych gości restauracji.

### 5d. Pozostałe treści z odnośników

- [ ] **Demo menu** (`#demo`) — wskazują na nie dwa CTA i stopka. Potrzebna publiczna
      restauracja demonstracyjna, oddzielona od danych klientów.
- [ ] **Baza wiedzy** (`#pomoc`) — instrukcje dla restauratora: dodanie menu, wydruk QR,
      obsługa KDS.
- [ ] **Pięć podstron segmentowych** ze stopki: restauracje, kawiarnie, bary i puby,
      hotele, sieci i food courty. Do rozważenia, czy budować wszystkie — może wystarczy
      jedna strona z sekcjami, a odnośniki poprowadzić do kotwic.

### 5e. Aplikacja marketingowa

- [ ] **`apps/web-marketing`** — Next.js SSG/ISR. Tokeny i komponenty przenieść z pliku
      projektowego, nie projektować od nowa. Dopiero to daje miejsce na formularze
      z 5a i 5b — statyczny plik ich nie obsłuży.

## 6. Jakość i wymagania niefunkcjonalne

Z [product.md §7](product.md#7-wymagania-niefunkcjonalne-dotyczą-wszystkich-trzech-systemów).

- [ ] **Testy e2e ścieżki gościa: zamawianie** — jest już dymny test wejścia po kodzie QR,
      znaku rozpoznawczego i wezwania kelnera. Brakuje pełnej drogi: koszyk, złożenie
      zamówienia, prośba o rachunek.
- [ ] **Dostępność WCAG 2.1 AA** w aplikacji gościa — używa jej przypadkowa publiczność.
- [ ] **Buforowanie offline w panelu** — wi-fi w lokalach bywa zawodne, a tablet nie może
      gubić akcji kelnera.
- [ ] **Menu gościa < 2 s na 4G** — zmierzyć na produkcji, nie zakładać.
- [ ] **Monitoring i alerty** — dziś awarię widać dopiero wtedy, gdy ktoś zadzwoni.

---

## Zrobione

- [x] Monorepo, schemat bazy, RLS z testem izolacji najemców
- [x] Ścieżka gościa: skan QR, menu, koszyk, złożenie zamówienia
- [x] Panel obsługi: kolejka potwierdzeń, KDS, rozliczanie stolika
- [x] Konfiguracja lokalu: menu w dwóch językach, stoliki, kody QR, ustawienia
- [x] Paleta jasna/ciemna na każdym ekranie
- [x] Wdrożenie produkcyjne: Docker Compose, Caddy, HTTPS, migracje jako osobne zadanie
- [x] Zmiana hasła przez pracownika z poziomu panelu
- [x] Testy e2e logowania i zmiany hasła (Playwright)
- [x] Strona produktowa na `kelbroo.com` (statyczna, z pliku projektowego) — potwierdzona na żywo 2026-08-23
- [x] [Instrukcja wdrożenia na Hostingerze](deploy-hostinger.md)
- [x] Ścieżka gościa przeszła na produkcji end-to-end (2026-08-23, weryfikacja ręczna)
- [x] Backup bazy ustawiony
- [x] Wydruk kodów QR działa
- [x] Konta pracowników z panelu: lista, zakładanie, role, wyłączanie, reset hasła
- [x] Zmiana własnego adresu e-mail i nazwy z panelu (koniec z `INSERT`-em w bazie)
- [x] Testy e2e zespołu (Playwright) i 12 testów jednostkowych granic uprawnień
- [x] Kelner składa i edytuje zamówienie w imieniu gościa, z wyborem stolika i uczestnika
- [x] Trzy atrybucje na pozycji (`added_by`, `for_participant_id`, `last_edited_by`) widoczne w panelu
- [x] Oznaczenie „obsługa" przy pozycjach w kolejce potwierdzeń i na KDS
- [x] Historia zmian zamówienia z `OrderEvent`, append-only, z aktorem
- [x] Stawka VAT w snapshocie pozycji — edycja przelicza podatek z niej, nie z bieżącego cennika
- [x] Podział rachunku: tryby `none` / `per_person` / `equal` / `groups` z grupami rozliczeniowymi
- [x] Ekran podziału w panelu i rozliczanie grupa po grupie, z zamknięciem wizyty po ostatniej
- [x] Niezmiennik podziału pokryty testem — suma grup równa rachunkowi, reszta do hosta
- [x] Konfiguracja panelu schowana pod rozwijanym menu „Ustawienia"
- [x] **Decyzja:** poczta przez SMTP Hostingera, nadawca `kontakt@kelbroo.com` (2026-08-23)
- [x] Wołanie kelnera: zgłoszenie gościa, lista w panelu, „Idę" i „Załatwione", sygnał realtime
- [x] Prośba o rachunek z wyborem podziału po stronie gościa — tą samą ścieżką co w panelu
- [x] Liczniki czekającej pracy przy pozycjach menu panelu, zależne od roli, z wezwaniami
- [x] Jedno połączenie realtime na kartę zamiast osobnego dla każdego ekranu
- [x] Status zamówienia na żywo u gościa — osobny kanał wizyty, z proxy w Caddym
- [x] Polling z przycisku wezwania kelnera zdjęty, zastąpiony zdarzeniem
- [x] Znak rozpoznawczy gościa: kształt w wyraźnym kolorze, para unikalna przy stoliku,
      widoczny w panelu i u gościa; wybór adresata na ekranie Zamów przez klikalne ikony
- [x] Cykl życia stolika: sprzątanie wizyty, usuwanie gościa, blokada na 2 minuty
      (ręczna i automatyczna po rozliczeniu), prośba gościa o otwarcie stolika
- [x] Odświeżenie po zapłaceniu nie otwiera nowej wizyty — token rozpoznaje swój rachunek
- [x] Host wpuszcza gości do stolika (przełącznik lokalu `host_approves_guests`), zgoda
      zastępcza przez obsługę, oczekujący nie zamówi — bariera po stronie serwera
- [x] Rozliczanie po jednym gościu jako przełącznik lokalu (`partial_settlement_enabled`)
- [x] Każda pozycja rachunku podpisana znakiem swojego właściciela, także cudza
- [x] Otwieranie stolika przez obsługę: przycisk przy każdym stoliku na sali (także wolnym)
      i przy zgłoszeniu gościa w kolejce; zdejmuje blokadę i zakłada wizytę
- [x] Sala pokazuje wszystkie stoliki lokalu, nie tylko te z otwartym rachunkiem
- [x] Gość czekający na otwarcie prosi o nie przyciskiem, a ekran puszcza sam po otwarciu
- [x] Odnośnik do karty gościa przy każdym stoliku na ekranie „Stoliki i QR" (poza wydrukiem)
- [x] Wejście gościa do poczekalni wysyła sygnał: host widzi kolejkę bez przeładowania,
      panel dostaje listę oczekujących w „Do potwierdzenia" i licznik przy pozycji menu
- [x] Gość wycofuje wezwanie kelnera drugim stuknięciem, dopóki nikt go nie przyjął
      (status `canceled`, osobny od `resolved`)
- [x] Zamawianie przeniesione na Salę — przycisk przy każdym stoliku, pozycja „Zamów"
      zdjęta z menu panelu
- [x] Półksiężyc zastąpiony samochodzikiem — jego kształt miał zerowe pole i nie rysował
      nic; kształty przeniesione do `packages/types`, test e2e liczy pomalowane piksele

---

## Decyzje do podjęcia

Blokują zadania powyżej — wymagają twojej decyzji, nie kodu.

- [ ] **Czy plan Menu (0 zł) wchodzi do oferty** — wpływa na zakres rejestracji i abonamentu (§5).
- [ ] **Walidacja cennika** rozmowami z 5–10 restauratorami przed publikacją strony.
- [x] **Czy gość w trybie `pay_at_table` widzi bieżący rachunek stolika** — tak, cały,
      z podpisem właściciela przy każdej pozycji (2026-08-23). Rachunek stolika jest wspólny
      i jedna osoba za niego płaci, więc ukrywanie jego części przed współbiesiadnikami
      uniemożliwiałoby sprawdzenie, za co się płaci. Prywatność chroni co innego:
      uczestnik nie jest kontem, a znak żyje tylko przez jedną wizytę.
      Do rozważenia w Fazie 2, jeśli restauracje zgłoszą potrzebę: przełącznik zawężający
      widok do własnych pozycji.
- [ ] **Kto pisze dokumenty prawne** — regulamin i polityka prywatności wymagają prawnika,
      nie szablonu z internetu.
