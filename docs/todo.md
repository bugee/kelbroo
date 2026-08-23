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

**Najbliższa blokada: sekcja 1.** Konto kelnera i kuchni zakłada się dziś `INSERT`-em
w bazie, więc panelu nie da się oddać nikomu poza właścicielem — a bez tego pilotaż
nie wyjdzie poza jedną osobę.

---

## 1. Konta pracowników (System 2)

Dziś konto kelnera czy kuchni zakłada się `INSERT`-em w bazie. To blokuje oddanie panelu
komukolwiek poza właścicielem.

- [ ] **CRUD pracowników w panelu** — lista, dodanie, dezaktywacja, zmiana roli.
      Rola `owner`/`manager` nadaje, `waiter`/`kitchen` nie widzi ekranu.
- [ ] **Hasło startowe przy zakładaniu konta** — konto powstaje z `mustChangePassword = true`,
      obsługa flagi jest już gotowa.
- [ ] **Zmiana adresu e-mail** — dziś wyłącznie przez SQL, z pułapką wielkich liter
      (logowanie szuka po `lower(trim())`, a porównuje dosłownie).
- [ ] **Reset hasła pracownika przez managera** — bez tego zapomniane hasło to znów wejście
      do bazy.

## 2. Zamawianie przez kelnera (System 2)

Wymóg z [product.md §5](product.md), dziś nieobsłużony — `staff.controller.ts` ma tylko
potwierdzanie, odrzucanie i zmianę statusu.

- [ ] **Kelner składa zamówienie w imieniu gościa** — wybór stolika, uczestnika i pozycji.
- [ ] **Kelner edytuje złożone zamówienie** — dodanie i usunięcie pozycji, zmiana ilości.
- [ ] **Trzy atrybucje na pozycji** — `added_by`, `for_participant_id`, `last_edited_by`;
      kolumny istnieją, trzeba je zacząć wypełniać z panelu.
- [ ] **Widoczne rozróżnienie gość / obsługa** na rachunku i w historii — podstawa rozliczania
      kelnera i rozstrzygania sporów.
- [ ] **Każda zmiana do `OrderEvent`** — append-only, nigdy nadpisywanie.

## 3. Podział rachunku (System 2 + 3)

Arytmetyka jest gotowa i pokryta testami w `packages/types/src/money.ts`
(`allocateByShares`, `allocateEqually`, `assertAllocationSumsTo`), ale **nie używa jej ani
jeden endpoint**. Model `SettlementGroup` nie ma żadnych odwołań w kodzie.

- [ ] **Tryby `none` / `per_person` / `equal` / `groups`** — wybór trybu na wizycie.
      `per_item` należy do etapu 2 (`OrderItemShare`).
- [ ] **API grup rozliczeniowych** — tworzenie, przypisanie uczestników, kwoty.
- [ ] **Ekran podziału w panelu kelnera.**
- [ ] **Prośba o rachunek z wyborem podziału** w aplikacji gościa.
- [ ] **Zamykanie rachunku po grupach** — dziś `sessions/:id/settle` przyjmuje jedną kwotę
      bez podziału.
- [ ] **Test niezmiennika** — suma grup równa sumie rachunku, reszta do hosta.

## 4. Pozostałe funkcje gościa (System 3)

Modele są w schemacie od pierwszej migracji i nie mają ani jednego odwołania w kodzie.

- [ ] **Status zamówienia na żywo** — `orders.gateway.ts` istnieje, ale aplikacja gościa
      nie używa Socket.IO, a Caddy proxuje `/socket.io` wyłącznie na domenie panelu.
      Wymaga zmiany w [deploy/Caddyfile](../deploy/Caddyfile).
- [ ] **Wołanie kelnera** (`WaiterCall`) — plus sygnał w panelu.
- [ ] **Ocena dania po posiłku** (`Review`).
- [ ] **Zestawienie rachunku na e-mail** — w projekcie **nie ma w ogóle wysyłki poczty**;
      trzeba wybrać dostawcę i dodać abstrakcję, zanim to powstanie.
- [ ] **Wybór nicku i awatara przez gościa** — dziś przydzielane automatycznie; zakres
      etapu 1 mówi o wpisaniu lub wylosowaniu.

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

- [ ] **Testy e2e ścieżki gościa** — Playwright pokrywa dziś tylko logowanie i zmianę hasła.
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

---

## Decyzje do podjęcia

Blokują zadania powyżej — wymagają twojej decyzji, nie kodu.

- [ ] **Czy plan Menu (0 zł) wchodzi do oferty** — wpływa na zakres rejestracji i abonamentu (§5).
- [ ] **Walidacja cennika** rozmowami z 5–10 restauratorami przed publikacją strony.
- [ ] **Dostawca wysyłki e-mail** — potrzebny do zestawienia rachunku.
- [ ] **Czy gość w trybie `pay_at_table` widzi bieżący rachunek stolika** — ryzyko, że goście
      przy jednym stoliku zobaczą nawzajem swoje zamówienia.
- [ ] **Kto pisze dokumenty prawne** — regulamin i polityka prywatności wymagają prawnika,
      nie szablonu z internetu.
