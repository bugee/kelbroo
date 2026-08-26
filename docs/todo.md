# Plan realizacji — MVP etap 1

Żywa lista zadań. Zakres pochodzi z [product.md §6](product.md#6-zakres-mvp-vs-faza-2):
tryb `pay_at_table`, bez płatności online i bez fiskalizacji.

**Jak z niej korzystać:** `[ ]` do zrobienia, `[x]` zrobione, `[~]` w trakcie.
Zadania są ułożone w kolejności realizacji — wcześniejsze odblokowują późniejsze.
Listę aktualizuję na bieżąco przy każdej zmianie w projekcie.

*Ostatnia aktualizacja: 2026-08-24*

---

## Stan na dziś

Działa produkcyjnie: API, panel obsługi i PWA gościa, strona produktowa
`kelbroo.com`, zaplecze `admin.kelbroo.com` — z HTTPS, migracjami i izolacją
danych przez RLS. **Pełna ścieżka gościa przeszła na produkcji** — skan QR, menu,
koszyk, zamówienie, kolejka potwierdzeń, KDS, rozliczenie stolika. Kody QR
drukują się, backupy bazy są ustawione.

**System 1 jest otwarty** (2026-08-24): rejestracja przyjmuje klientów, e-mail jest
weryfikowany, regulamin i polityka prywatności są opublikowane, a wygaśnięcie
abonamentu wyłącza zamawianie bez kasowania danych.

**Sprzedaż działa na produkcji** (2026-08-26): konto sprzedawcy PayU jest aktywne,
a klient kupuje abonament sam — miesięcznie albo rocznie, BLIK-iem, przelewem lub
kartą. Wpłaty uzgadniamy z operatorem co dziesięć minut, więc zgubione powiadomienie
odnajduje się samo i zgłasza. Klient dostaje trzy przypomnienia o kończącym się
okresie; poczta wychodząca też działa.

Wraz z tym **kelbroo przetwarza prawdziwe pieniądze**, a to zmienia wagę trzech
rzeczy. Faktury VAT wystawiamy ręcznie po powiadomieniu na `kontakt@kelbroo.com`
(termin liczy się od sprzedaży, nie od zajrzenia do skrzynki). Zwroty robione
w panelu PayU nie cofają abonamentu — trzeba go skrócić z zaplecza. I najpilniejsze:
**polityka prywatności nie wymienia PayU wśród odbiorców danych**, choć przy każdym
zakupie trafia tam adres e-mail i IP nabywcy ([docs/legal §8 poz. 4](legal/README.md)).

**System 4 — zaplecze kelbroo** stoi i ma logowanie dwuskładnikowe, listę klientów,
kartę klienta oraz operacje na abonamencie z dziennikiem. Obsługa klienta nie
wymaga już `psql` ani ręcznej edycji `.env.prod`.

Czego brakuje do pełnego zakresu etapu 1: dwóch modeli, które wciąż nie mają ani
linii kodu — `Review` (ocena dania) i `OrderItemShare` (podział `per_item`, zakres
etapu 2) — oraz czterech funkcji gościa z sekcji 4.

**Dwie rzeczy, które dziś najbardziej ciążą, i żadna nie jest funkcją:**

1. **Ścieżka gościa jest potwierdzona ręcznie, jednorazowo.** Zamawianie, koszyk
   i prośba o rachunek nie mają testu e2e (§7). To najkrótsza droga do tego, żeby
   regresja nie wróciła niezauważona.
2. **Awarię widać dopiero wtedy, gdy ktoś zadzwoni** (§7) — z jednym wyjątkiem:
   płatności mają od 2026-08-26 własne uzgadnianie z operatorem, więc wpłata
   bez powiadomienia sama się odnajduje i zgłasza. Reszta systemu takiego
   czujnika nie ma.

---

## 4. Pozostałe funkcje gościa (System 3)

Modele są w schemacie od pierwszej migracji i nie mają ani jednego odwołania w kodzie.

- [ ] **Ocena dania po posiłku** (`Review`).
- [ ] **Zestawienie rachunku na e-mail** — **warstwa poczty już jest** (`MailService`,
      §5a), zostaje treść wiadomości i miejsce, w którym gość podaje adres. Adres
      wykorzystujemy jednorazowo i nie zapisujemy — tak mówi polityka prywatności §9.
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

Pod `kelbroo.com` stoi `apps/web-marketing`. Rejestracja i dokumenty prawne działają;
**6 z 33 odnośników wciąż nie ma celu** (2026-08-26, po dodaniu kontaktu i demo) —
zostają baza wiedzy i pięć podstron segmentowych. Poniższe zadania to dokładnie ta lista braków.

### 5a. Rejestracja i okres próbny

Sekcja `#trial` obiecuje wprost: *„14 dni planu Pro bez opłat i bez podawania karty"*.
Nie stoi za tym żaden formularz ani endpoint — przycisk **„Zacznij za darmo"** prowadzi
do `#rejestracja`, którego nie ma.

- [x] **Formularz rejestracji** — `apps/web-marketing/app/rejestracja`. Strona istnieje,
      ale **nie jest podlinkowana** z żadnego CTA; przyciski wciąż prowadzą do `#trial`.
- [x] **Endpoint zakładający konto** — `POST /auth/register`, wszystko w jednej transakcji.
- [x] **Okres próbny 14 dni** — plan `pro`, `status = trialing`.
- [x] **Rejestracja otwarta** (2026-08-24) — domyślnie włączona w compose, wszystkie
      sześć wezwań do założenia konta prowadzi do `/rejestracja`. `REGISTRATION_ENABLED`
      zostaje jako wyłącznik awaryjny.
- [x] **Weryfikacja adresu e-mail** (2026-08-24) — konto powstaje niepotwierdzone
      i **nie wpuszcza do panelu**, dopóki klient nie kliknie w odnośnik z wiadomości.
      Token trzymany jako skrót, ważny 48 h, jednorazowy; ponowna wysyłka ze strony
      `/potwierdz` odpowiada tak samo dla nieistniejącego konta.
- [x] **NIP przy rejestracji** — sprawdzany sumą kontrolną po obu stronach
      (`@kelbroo/types`), zapisywany bez myślników.
- [x] **Powiadomienie o nowym koncie** na `kontakt@kelbroo.com`, z nazwą lokalu,
      NIP-em i adresem właściciela.
- [x] **Warstwa poczty** (`MailService`) — dostawca jest abstrakcją: bez `SMTP_HOST`
      wiadomości trafiają do logu i nic nie wychodzi na zewnątrz. Odblokowuje też
      zestawienie rachunku z §4.
- [x] **Weryfikacja adresu e-mail** (2026-08-24) — konto nie wpuszcza do panelu przed
      potwierdzeniem; token ważny 48 h, jednorazowy, w bazie tylko jako skrót.
- [x] **Wygaśnięcie abonamentu wyłącza zamawianie** (2026-08-24) — u gościa i w panelu,
      z zachowaniem rozliczania otwartych rachunków. Dane nie są kasowane.
- [x] **Zakup abonamentu Starter i Pro** (2026-08-26) — PayU, płatność jednorazowa
      za miesiąc albo rok, ekran `panel.kelbroo.com/abonament`. Abonament przedłuża
      **wyłącznie** podpisane powiadomienie operatora, nigdy powrót przeglądarki;
      powtórzone powiadomienie nie daje drugiego okresu. Kwoty zamrożone w
      `SubscriptionOrder`, ceny i limity w jednym katalogu (`packages/types/plans.ts`).
      Ścieżka przetestowana na sandboksie aż do bramki i z powrotem, a od 2026-08-26
      działa na koncie produkcyjnym PayU.
      Szczegóły i uzasadnienia: [architecture.md §11a](architecture.md).
- [x] **Uzgadnianie płatności z operatorem** (2026-08-26) — co 10 minut zadanie pyta
      PayU o stan zamówień wiszących dłużej niż 15 minut, księguje opłacone tą samą
      drogą co powiadomienie, zamyka odrzucone i po 48 h porzucone. Alarm idzie na
      `kontakt@kelbroo.com` tylko wtedy, gdy wpłata została odzyskana — czyli gdy
      powiadomienia naprawdę nie działają. Podwójnemu księgowaniu zapobiega bramka
      w bazie, pokryta testem dwóch równoczesnych prób.
- [x] **Przypomnienia o kończącym się okresie** (2026-08-26) — trzy wiadomości na okres:
      3 dni przed, w dniu wygaśnięcia i 3 dni po. Dotyczy tak samo okresu próbnego,
      który dotąd kończył się bez jednego sygnału poza paskiem w panelu. Jedno
      przypomnienie dziennie, to najdalej posunięte z należnych — po przestoju zadanie
      nie nadrabia zaległości serią. Powtórce zapobiega unikalność w bazie, nie warunek
      w kodzie. Pomijamy konta zablokowane i wygasłe dawniej niż 30 dni.
- [ ] **Automatyczne odnawianie z karty — priorytet średni.** Token PayU, obciążanie
      bez udziału klienta. Wymaga włączenia „płatności automatycznych" na POS-ie
      i wyklucza BLIK, więc wchodzi jako **wybór klienta obok** płatności
      jednorazowej, nie zamiast niej. Zakup jednorazowy (zrobiony) jest jego
      warunkiem koniecznym — nic z tamtej pracy nie przepada.
- [ ] **Faktury VAT automatycznie — priorytet niski, świadomie odłożone (2026-08-26).**
      **Obsługujemy je ręcznie** i tak zostaje: po każdej wpłacie na
      `kontakt@kelbroo.com` przychodzi komplet danych nabywcy, a fakturę wystawiasz
      w programie księgowym. Przy kilku klientach to minuty miesięcznie, a numeracja
      i archiwum zostają tam, gdzie i tak muszą być.

      Jedna rzecz do pilnowania po ludzku, dopóki to nie jest zautomatyzowane:
      **termin wystawienia liczy się od sprzedaży, nie od zajrzenia do skrzynki.**
      Wraca do rozważenia dopiero wtedy, gdy liczba wpłat sprawi, że ręczne
      wystawianie zacznie się opóźniać — wtedy integracja z systemem księgowym
      przez API (Fakturownia, wFirma, InFakt).
- [x] **CTA podpięte do rejestracji** (2026-08-24) — wszystkie sześć prowadzi
      do `/rejestracja`.

### 5b. Kontakt i prezentacja

Sekcja istnieje od 2026-08-26 i wszystkie trzy przyciski w nią trafiają:
„Porozmawiajmy" z planu Enterprise, „Umów prezentację" z sekcji końcowej
i „Kontakt" w stopce.

Formularz jest publiczny i **wysyła pocztę na cudze polecenie**, więc ma dwie
niezależne bariery: limit pięciu zgłoszeń na godzinę z jednego adresu IP oraz
ukryte pole-pułapkę. Robot, który w nią wpadnie, dostaje **tę samą odpowiedź
co człowiek** — automat, któremu powiemy „odrzucono", spróbuje inaczej.

- [x] **Sekcja kontaktowa** (2026-08-26) — `#kontakt` na stronie głównej, jeden formularz
      na dwie sprawy. Wszystkie trzy przyciski mają wreszcie cel.
- [x] **„Umów prezentację"** (2026-08-26) — ten sam formularz z przełącznikiem celu;
      kotwica `#prezentacja` ustawia go z góry, więc nikt nie wybiera dwa razy. Przy
      prezentacji dochodzi pole preferowanego terminu. Enterprise z cennika prowadzi
      teraz tutaj, a nie na ogólne pytanie — sieci nie zakładają konta samodzielnie.
- [x] **Dane firmy** (2026-08-26) — nazwa, adres i NIP w sekcji kontaktowej. To był
      wymóg ustawy o świadczeniu usług drogą elektroniczną, nie brak treści.
- [ ] **Kalendarz prezentacji** — dziś klient wpisuje preferowany termin słowami,
      a my odpisujemy ręcznie. Wystarczy przy kilku zgłoszeniach tygodniowo; przy
      większej liczbie wróci jako integracja z kalendarzem.

### 5c. Treści prawne w stopce

- [x] **Regulamin** — [docs/legal/regulamin.md](legal/regulamin.md), publikowany pod
      `/regulamin` (2026-08-24).
- [x] **Polityka prywatności** — [docs/legal/polityka-prywatnosci.md](legal/polityka-prywatnosci.md),
      pod `/prywatnosc`. Obejmuje obowiązek informacyjny RODO, więc odnośnik „RODO"
      w stopce prowadzi do jej §8 zamiast do osobnego dokumentu.
- [x] **Zgody przy rejestracji** — dwa wymagane pola, zapisywane z **wersją dokumentu**.
- [x] **Wygaśnięcie abonamentu wstrzymuje zamawianie także w panelu** (2026-08-24) —
      wcześniej blokowało wyłącznie gościa, więc lokal bez abonamentu pracował dalej.
      Rozliczanie otwartych rachunków zostaje dostępne, a panel mówi o tym paskiem.
      **Zostaje poprawka w regulaminie:** „tryb do odczytu" jest za mocny wobec tego,
      co robimy — proponowane brzmienie w [legal/README.md §8](legal/README.md).
- [ ] **Domknąć pozostałe obietnice bez pokrycia w kodzie** — spis w
      [docs/legal/README.md §8](legal/README.md): usunięcie danych po 6 miesiącach
      (żadnego mechanizmu retencji nie ma) i wypowiedzenie umowy z poziomu panelu.
- [x] **NIP przy rejestracji** (2026-08-24) — ze sprawdzeniem sumy kontrolnej po obu
      stronach. **Adres firmy zbieramy od 2026-08-26** — jest polem obowiązkowym przy
      zakupie abonamentu, bo faktura VAT bez adresu nabywcy nie jest fakturą.

### 5d. Pozostałe treści z odnośników

- [x] **Demo menu** (`#demo`) (2026-08-26) — publiczna restauracja pokazowa pod
      `/t/demo`, zakładana skryptem `scripts/seed-public-demo.ts`. Oddzielona od
      klientów flagą `Organization.isDemo`: nie liczy się w statystykach zaplecza
      i nie dostaje przypomnień o abonamencie. Potwierdzanie przez kelnera jest w niej
      wyłączone, bo żadnego kelnera tam nie ma — z włączonym zwiedzający zobaczyłby
      zamówienie wiszące w nieskończoność. Gość widzi u góry pasek, że to demonstracja.
      Wizyty starsze niż 30 minut kasuje zadanie cykliczne.
- [ ] **Baza wiedzy** (`#pomoc`) — instrukcje dla restauratora: dodanie menu, wydruk QR,
      obsługa KDS.
- [ ] **Pięć podstron segmentowych** ze stopki: restauracje, kawiarnie, bary i puby,
      hotele, sieci i food courty. Do rozważenia, czy budować wszystkie — może wystarczy
      jedna strona z sekcjami, a odnośniki poprowadzić do kotwic.

### 5e. Aplikacja marketingowa

- [x] **`apps/web-marketing`** — Next.js, strona renderowana statycznie. Znaczniki i style
      przeniesione z pliku projektowego 1:1; cennik przepisany na dane (przełącznik okresu
      jest jedynym stanem), ruch strony w osobnym komponencie klienckim.
- [x] **Caddy przełączony na `apps/web-marketing`** — własna usługa w compose, blok
      `{$LANDING_DOMAIN}` przepięty z `file_server` na `reverse_proxy`, mount pliku zdjęty.

      > Plik projektowy **nie ma `<!DOCTYPE html>`**, więc przeglądarki renderują go
      > w trybie zgodności wstecznej. Nowa strona ma doctype i tryb standardowy — stąd
      > jedyna różnica między nimi: wiersze gości na karcie „Rachunek stolika" są o 7 px
      > wyższe. Nowa wersja jest poprawna; starej nie naprawiamy, bo i tak ją zastąpi.

## 6. System 4 — zaplecze kelbroo (`apps/web-backoffice`)

Zaplecze dla **nas**, nie dla restauracji. Dziś każda z tych czynności wymaga wejścia
do bazy przez `psql` albo ręcznej edycji `.env.prod` — to działa przy jednym kliencie
i przestaje działać przy trzecim.

**Osobny system, osobna aplikacja, osobna domena** — decyzja z 2026-08-24, zapisana
w [CLAUDE.md](../CLAUDE.md). Nie rozszerzamy panelu restauracji o tryb administratora:
to dwie różne publiczności, dwa różne modele tożsamości i dwa różne zakresy dostępu
do danych. Katalog nazywa się `web-backoffice`, nie `web-admin`, bo ta druga nazwa
jest zajęta przez panel restauracji.

### 6a. Decyzja przed kodem: kim jest administrator kelbroo

To nie jest kolejna rola w `StaffMember`. Pracownik kelbroo **nie należy do żadnej
organizacji**, a cała izolacja danych stoi na tym, że każde zapytanie ma ustawionego
najemcę (`app.current_organization_id`). Panel administracyjny z definicji musi czytać
w poprzek najemców — czyli robić dokładnie to, przed czym broni RLS.

Do rozstrzygnięcia **przed** napisaniem pierwszego ekranu:

- [x] **Model tożsamości** (2026-08-25) — osobna tabela `PlatformAdmin`, osobne
      logowanie, **osobny sekret tokenu**. Rola aplikacyjna pod RLS nie ma do tej tabeli
      dostępu; uprawnienia odbiera migracja.
- [~] **Sposób dostępu do danych** — lista klientów jako jedyna sięga po połączenie
      katalogowe, bo z definicji czyta w poprzek najemców. Pozostałe ekrany mają iść
      przez `withTenant`. Trzy drogi, każda z inną ceną:
      połączenie omijające RLS (jak `DIRECT_DATABASE_URL` w logowaniu) jest najprostsze,
      ale jeden błąd w zapytaniu odsłania wszystko; wąskie funkcje `SECURITY DEFINER`
      są bezpieczne i pracochłonne; `withTenant` po jednym kliencie naraz wystarcza
      do większości ekranów i **jest domyślną odpowiedzią**, dopóki ktoś nie wykaże,
      że konkretny widok bez tego nie powstanie.
- [x] **Osobna subdomena i osobne uwierzytelnienie** — `admin.kelbroo.com`
      (2026-08-26). Panel restauracji i zaplecze nie dzielą sesji ani ciasteczek.
- [x] **2FA dla kont zaplecza** — kod sześciocyfrowy na adres administratora
      (2026-08-26). Hasło otwiera już tylko pierwszy krok: `POST /platform/login`
      nie wydaje tokenu, a jedynie uchwyt do `POST /platform/login/verify`.
      Kod jest ważny 10 minut, działa raz, pięć pomyłek unieważnia całą próbę,
      a nowe logowanie kasuje kod z poprzedniego. W bazie leży wyłącznie skrót
      SHA-256 — podgląd tabeli nie pozwala się zalogować.

      Ograniczenie po adresie IP zostało świadomie odłożone (2026-08-26), więc
      poczta jest dziś jedyną drugą barierą. Wybrana zamiast TOTP, bo nie wymaga
      zakładania aplikacji uwierzytelniającej ani ścieżki odzyskiwania konta przy
      zgubionym telefonie; **jej ceną jest to, że przejęta skrzynka administratora
      wystarcza za drugi składnik** — dlatego adresy administratorów muszą mieć
      własne 2FA u dostawcy poczty.

> **Prawnie:** wobec danych lokalu jesteśmy **podmiotem przetwarzającym**
> ([docs/legal](legal/README.md) §2). Administrator kelbroo oglądający zamówienia gości
> przetwarza cudze dane osobowe — musi to być ograniczone, uzasadnione i **zapisane
> w dzienniku**. Umowa powierzenia powinna to opisywać, zanim funkcja powstanie.

### 6b. Klienci

> **Lokalnie:** zaplecze stoi na `http://localhost:3004`, a jego port musi być
> w `CORS_ORIGINS` — inaczej logowanie kończy się w przeglądarce komunikatem
> „Failed to fetch", którego nie widać ani w logu API, ani na ekranie.
> `.env.example` wymienia komplet czterech portów.

- [x] **Lista klientów** (2026-08-25) — organizacja, NIP, lokale, plan, status
      abonamentu, okres próbny, termin ważności, liczba stolików i kont, ostatnie
      logowanie. Z wyszukiwaniem i podsumowaniem u góry.
- [x] **Karta klienta** (2026-08-26) — abonament z limitami, lokale, personel
      z ostatnim logowaniem, zgody z wersją dokumentu i historia operacji.
      Czyta przez `withTenant` — patrzymy na jedną organizację, więc nie ma powodu
      omijać RLS.
- [x] **Wyszukiwanie** po nazwie, NIP-ie, adresie e-mail i nazwie lokalu (2026-08-25).
- [~] **Zdrowie wdrożenia** — lista pokazuje już liczbę stolików, kont personelu
      i **ostatnie logowanie** (klient, który nigdy nie wszedł, jest oznaczony).
      Brakuje liczby pozycji w karcie i zamówień z ostatnich 7 dni.
      Bez tego nie widać różnicy między klientem zadowolonym a takim, który założył
      konto i nigdy go nie użył — a to drugie jest sygnałem do telefonu, nie do faktury.

### 6c. Parametryzacja klienta

- [x] **Limity planu** (2026-08-26) — widoczne na karcie i przestawiane razem
      ze zmianą planu. Osobnego nadpisania ponad plan wciąż nie ma.
- [ ] **Ustawienia lokalu z poziomu wsparcia** — te same przełączniki, które ma manager
      (tryb zamawiania, potwierdzanie, zgoda hosta, rozliczanie po jednym).
- [ ] **Przełączniki funkcji per klient** — pilotaż nowej funkcji u jednego lokalu bez
      wypuszczania jej wszystkim. Dziś każda taka decyzja to wdrożenie całej aplikacji.
- [ ] **Nadpisanie limitu ponad plan** — sieć na 45 stolikach przy planie na 40 ma
      dostać zgodę handlową, a nie awarię w piątek wieczorem.

### 6d. Abonamenty i płatności

> **Zależy od etapu 2.** Dopóki nie ma operatora płatności, ta część sprowadza się
> do ewidencji: co komu wystawiono i co wpłynęło. Ma to sens także bez Stripe'a.

- [x] **Historia abonamentu** (2026-08-26) — dziennik zaplecza notuje każdą
      operację z powodem i podpisem administratora; ostatnie 20 wpisów na karcie.
- [ ] **Stan rozliczenia** — opłacone do kiedy, ile zalega, od ilu dni.
- [ ] **Zaległości** — lista klientów po terminie, posortowana po tym, jak długo.
- [x] **Faktury VAT za abonament — rozstrzygnięte (2026-08-26): wystawiamy ręcznie
      poza kelbroo.** Sprzedaż B2B w Polsce, więc faktura nie jest opcją, ale
      numeracja i archiwum to obowiązki ustawowe — zostają w programie księgowym,
      nie w naszym kodzie. Po każdej wpłacie idzie na `kontakt@kelbroo.com`
      wiadomość z kompletem danych nabywcy. Automatyzacja: §5a, priorytet niski.
- [ ] **Ręczna korekta** — rabat, przedłużenie, anulowanie należności. Każda z powodem
      i podpisem osoby, która ją wprowadziła.

### 6e. Blokowanie i odblokowywanie

- [x] **Blokada administracyjna** (2026-08-26) — stan osobny od wygaśnięcia,
      wstrzymuje nowe zamówienia u gościa i w panelu, **nie kasuje danych**.
      Zdejmuje ją człowiek, też z powodem.
- [x] **Stopnie blokady** — rozstrzygnięte 2026-08-26: blokada wstrzymuje **nowe
      zamówienia**, zostawiając rozliczanie otwartych rachunków i wgląd w panel.
      Ta sama granica co przy wygasłym abonamencie. Odcięcie całego panelu uwięziłoby
      lokalowi gotówkę i zrobiło z naszej decyzji jego awarię.
- [x] **Powód wymagany** przy każdej operacji zaplecza (2026-08-26) — przedłużeniu,
      zmianie planu, blokadzie i odblokowaniu. Trafia do dziennika.
- [ ] **Nigdy nie kasuje danych** — zasada z [CLAUDE.md](../CLAUDE.md) obowiązuje tak
      samo przy blokadzie ręcznej, jak przy wygaśnięciu.

### 6f. Zakładanie kont przez nas

- [ ] **Formularz zakładania konta w imieniu klienta** — **tanie, wynika wprost
      z tego, co jest**: `RegistrationService` robi już całą pracę, brakuje wejścia
      dla administratora. Przydatne przy sprzedaży przez telefon i przy większych
      lokalach, które nie założą konta same.
- [ ] **Zaproszenie zamiast hasła** — zakładamy konto, klient sam ustawia hasło
      z jednorazowego odnośnika. **Wymaga poczty** (ta sama blokada co §4 i §5a).
- [ ] **Zgody przy koncie zakładanym przez nas** — kto i kiedy zaakceptował regulamin,
      skoro nie było formularza. Do rozstrzygnięcia z prawnikiem; najprawdopodobniej
      akceptacja przy pierwszym logowaniu klienta.

### 6g. Okresy próbne

- [ ] **Lista trwających okresów próbnych** z datą końca i tym, czy klient w ogóle
      zaczął korzystać. **Tanie**: lista klientów ma już wszystkie te dane, brakuje
      filtra i sortowania po dacie końca. To ekran, na który patrzy się rano.
- [x] **Przedłużenie okresu próbnego** (2026-08-26) — o 1–365 dni, z powodem.
      Liczone od dziś, gdy termin już minął.
- [ ] **Konwersja na płatny plan** bez zakładania konta od nowa.
- [ ] **Co się dzieje po wygaśnięciu** — dziś zamawianie się wyłącza. Do rozstrzygnięcia,
      czy przechodzimy na darmowy plan Menu, czy zostawiamy konto martwe.
- [ ] **Przypomnienia przed końcem** — 3 dni przed. **Wymaga poczty.**

### 6h. Wsparcie i bezpieczeństwo

- [ ] **Wejście w konto klienta** — najbardziej przydatna funkcja wsparcia i najbardziej
      niebezpieczna w całym systemie. Wymaga: wyraźnego oznaczenia na ekranie, że to
      sesja wsparcia, wygasania po godzinie, i **wpisu w dzienniku przy każdym wejściu**.
      Bez tych trzech rzeczy nie budować.
- [x] **Dziennik działań administratora** (2026-08-26) — `PlatformAuditLog`, osobny
      od `AuditLog` restauracji, poza zasięgiem roli aplikacyjnej.
- [ ] **Dziennik podglądów** — dziś wiadomo, **kto co zmienił**, ale nie **kto co
      obejrzał**. Przy jednym administratorze to niewielka luka; przy pierwszym
      pracowniku wsparcia przestaje taka być, bo wtedy „ktoś przeglądał dane klienta"
      staje się pytaniem, na które trzeba umieć odpowiedzieć.

      Wobec danych lokalu jesteśmy podmiotem przetwarzającym ([legal §2](legal/README.md)),
      więc to nie jest wyłącznie higiena — umowa powierzenia opisuje dostęp
      Usługodawcy do powierzonych danych i powinna dać się z tego rozliczyć.
- [ ] **Ograniczenie dostępu do danych gości** — panel administracyjny nie potrzebuje
      treści zamówień do żadnego z ekranów powyżej. Domyślnie ich nie pokazuje.
- [ ] **Usunięcie konta klienta i eksport danych** — obiecane w szkicu regulaminu (§9),
      dziś nie istnieje w żadnej postaci.

---

## 7. Jakość i wymagania niefunkcjonalne

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
      panel dostaje listę oczekujących w „Powiadomieniach" i licznik przy pozycji menu
- [x] Podgląd zamówień stolika w panelu: pozycje ze statusem widzianym przez gościa,
      w dwóch widokach — po gościach i po kategoriach z rozbiciem na dania
- [x] Prośba o rachunek pyta o formę płatności (karta / gotówka / obie przy podziale)
      i o fakturę VAT; deklaracja trafia do kolejki zgłoszeń i na kartę stolika
- [x] Nicki przy jednym stoliku nie powtarzają ani przymiotnika, ani zwierzęcia,
      dopóki starcza słów — goście mówią o sobie skrótem („ten uparty", „Kruk")
- [x] Skład stolika u gościa: licznik osób przy nazwie stolika, po kliknięciu lista
      pozostałych wpuszczonych gości z oznaczeniem hosta; host widzi to też przy sobie
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
      nie szablonu z internetu. Materiał dla niego jest gotowy i samodzielny:
      [docs/legal/pytania-do-prawnika.md](legal/pytania-do-prawnika.md) — pięć zapisów
      rozjeżdżających się ze stanem faktycznym, siedem decyzji do podjęcia i komplet
      faktów o systemie. Najpilniejsza pozycja dotyczy PayU w polityce prywatności.
- [x] **Czy zaplecze to czwarty system** — tak, osobna aplikacja `apps/web-backoffice`
      pod `admin.kelbroo.com` (2026-08-24). Powód: inna publiczność, inny model
      tożsamości i inny zakres dostępu do danych niż w panelu restauracji.
- [ ] **Jak panel administracyjny sięga po dane w poprzek najemców** — cała izolacja stoi
      na RLS, a to zaplecze musi ją omijać. Trzy drogi opisane w §6a; wybór przesądza,
      ile pracy i ile ryzyka niesie każdy kolejny ekran.
- [ ] **Czy wsparcie może wchodzić w konto klienta** — najbardziej przydatna funkcja
      zaplecza i najbardziej niebezpieczna. Jesteśmy podmiotem przetwarzającym, więc
      to pytanie jest tak samo prawne, jak techniczne (§6h).
