# Plan realizacji — MVP etap 1

Żywa lista zadań. Zakres pochodzi z [product.md §6](product.md#6-zakres-mvp-vs-faza-2):
tryb `pay_at_table`, bez płatności online i bez fiskalizacji.

**Jak z niej korzystać:** `[ ]` do zrobienia, `[x]` zrobione, `[~]` w trakcie.
Zadania są ułożone w kolejności realizacji — wcześniejsze odblokowują późniejsze.
Listę aktualizuję na bieżąco przy każdej zmianie w projekcie.

*Ostatnia aktualizacja: 2026-08-27*

---

## Stan na dziś

Działa produkcyjnie: API, panel obsługi i aplikacja gościa, strona produktowa
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

Wraz z tym **kelbroo przetwarza prawdziwe pieniądze**, a to zmienia wagę dwóch
rzeczy. Faktury VAT wystawiamy ręcznie po powiadomieniu na `kontakt@kelbroo.com`
(termin liczy się od sprzedaży, nie od zajrzenia do skrzynki). Zwroty robione
w panelu PayU nie cofają abonamentu — trzeba go skrócić z zaplecza. Trzecia,
najpilniejsza — brak PayU wśród odbiorców danych w polityce prywatności — została
domknięta 27 sierpnia. **Od 2026-08-28 oba dokumenty są w wersji od prawnika**,
z kompletem odpowiedzi na pytania z briefu, a rejestr rozbieżności
([docs/legal §8](legal/README.md)) jest zamknięty. Zostaje z nich zawiadomienie
klientów o nowych wersjach — jedno pismo obejmuje obie zmiany.

**System 4 — zaplecze kelbroo** stoi i ma logowanie dwuskładnikowe, listę klientów,
kartę klienta oraz operacje na abonamencie z dziennikiem. Obsługa klienta nie
wymaga już `psql` ani ręcznej edycji `.env.prod`.

**Zakres etapu 1 jest domknięty co do funkcji** (2026-08-27): ostatnie dwa braki —
zestawienie rachunku na e-mail i podział `per_item` — zostały dopisane. Żaden model
ze schematu nie stoi już bez kodu.

**Dwie rzeczy ciążą dziś najbardziej i żadna nie jest funkcją:**

1. **Nikt nie sprawdza serwera z zewnątrz** (§7). Od 2026-08-27 API zgłasza pocztą
   własne awarie — bazę, Redisa, wywrócone zadania, odmowy operatora płatności.
   Zostaje dziura, której z definicji nie da się zatkać od środka: **martwy proces
   nie wyśle wiadomości o własnej śmierci**. Potrzebny monitor spoza maszyny.
2. **Jedna obietnica ze strony produktowej nie ma pokrycia w kodzie** (§5f,
   przeliczone 2026-08-27; z dziewięciu trzy zamknięto skreśleniem obietnicy,
   pięć dopisaniem kodu). Zostaje **analityka i eksport raportów** — najbardziej
   rozbudowana pozycja z całej listy.

Ścieżka gościa ma od 2026-08-27 test e2e (§7) — zamawianie, kolejka potwierdzeń,
obie strony bramki kuchennej i rozliczenie stolika. Regresja nie wróci już
niezauważona tą drogą.

---

## 4. Pozostałe funkcje gościa (System 3)

Modele są w schemacie od pierwszej migracji i nie mają ani jednego odwołania w kodzie.

- [x] **Ocena dania po posiłku** (2026-08-27) — gość ocenia **swoje wydane dania**
      (1–5) i całą wizytę, wskazując, czy mówi o jedzeniu, czy o obsłudze, plus
      wiadomość do managera. Pytanie stoi przy rachunku, bo to jedyny moment,
      w którym „jak było?" nie przerywa posiłku.

      **Jedno zgłoszenie na gościa, nie na stolik.** Limit per stolik oddałby głos
      wyłącznie temu, kto zdążył pierwszy — stąd nowa kolumna `Review.participantId`.
      Nie ocenia się cudzych dań: rachunek jest wspólny, smak już nie.

      Przy niskiej ocenie **nie ma zachęty do publicznej recenzji** — jest zapewnienie,
      że wiadomość trafiła do managera. W tym leży cała funkcja: niezadowolony gość
      ma powiedzieć restauracji, zanim powie internetowi. Dlatego w panelu
      nieprzeczytane stoją na górze — bez czytania mechanizm jest pozorny.

      **Funkcja planu Pro i wyższych** (2026-08-27), z możliwością włączenia
      pojedynczemu klientowi z zaplecza. Bramka stoi po stronie serwera: przy
      wyłączonej funkcji gość nie dostaje zaproszenia, a zgłoszenie wysłane mimo
      wszystko jest odrzucane. Historii już zebranych opinii **nie odbieramy** przy
      spadku planu — plan ogranicza zbieranie, nie dostęp do własnych danych.

      **Nie zbudowane z docs/03 §3.8:** odnośnik do opinii w Google przy ocenie 4–5
      (wymaga adresu per lokal), średnia ocena na karcie dania i pokazywanie ocen
      innych gości (to decyzja restauracji, więc osobny przełącznik).
- [x] **Zestawienie rachunku na e-mail** (2026-08-27) — „kto co zamówił", pogrupowane
      po uczestnikach, z sumą, nazwą lokalu, numerem stolika i datą. **Każdy przy stoliku
      wysyła sobie własną kopię**, niezależnie od tego, kto zapłacił: to jego rozliczenie
      delegacji, nie przywilej płatnika.

      Formularz stoi w dwóch miejscach, bo gość trafia tu dwiema drogami: przy rachunku
      (nie zamykał karty) i na ekranie „Rachunek rozliczony" (odświeżył po zapłacie
      u kelnera). Ta druga jest częstsza.

      **Adresu nie zapisujemy nigdzie** — ani w bazie, ani w dzienniku, ani w logu, ani
      w pamięci przeglądarki. Tak opisuje to polityka prywatności §9 ust. 1 i tak ma
      zostać: zapamiętanie adresu zamieniłoby wysyłkę zestawienia w zbieranie bazy
      adresowej. Dokument mówi wprost, że **nie jest paragonem fiskalnym**.

      Dwie rzeczy warte zapamiętania. Nick i nazwa dania pochodzą **od gościa**, a szablon
      poczty wstawia akapity surowo — bez ucieczki byłby to zastrzyk znaczników do
      wiadomości wychodzącej z naszego adresu; `escapeHtml` jest teraz wyeksportowany
      i wołany po stronie serwisu. Limit wysyłek liczy się **na sesję gościa, nie na adres
      IP**: cały lokal wychodzi jednym łączem, więc limit po IP dławiłby dwudziestu gości
      z powodu pierwszego.

      **Zamyka obietnicę stojącą na stronie głównej** („każdy może wysłać sobie na e-mail
      zestawienie »kto co zamówił«"), której rejestr §5f nie miał — była sprzedawana bez
      pokrycia i bez policzenia.
- [x] **Wpisanie własnego nicku przez gościa** (2026-08-26) — propozycja pokazuje się
      **obok menu, nie przed nim**: gość siada do stolika, żeby zamówić, a nie wypełnić
      formularz. Zmiana jest możliwa **raz na wizytę**, bo nick jest podpisem pod
      pozycjami wspólnego rachunku i nazwa zmieniana w trakcie rozjechałaby to, co inni
      zdążyli zobaczyć. Blokada siedzi na serwerze (`nameChosenAt`), nie w przeglądarce.
      Nazwa musi być niepowtarzalna przy stoliku, bez względu na wielkość liter.

      **Awatara gość nie wybiera** i na razie nie będzie: znak rozpoznawczy służy do
      wypowiedzenia kelnerowi („żółty samochodzik") i musi zostać niepowtarzalny przy
      stoliku — wybór gościa psułby tę gwarancję, nic nie dodając.
- [x] **Przesadzenie gości przy inny stolik** (2026-08-27) — `Przesadź gości` na ekranie
      Sala przenosi całą wizytę pod wybrany **wolny** stolik. Dotąd jedyną drogą było
      rozliczenie rachunku i otwarcie nowego, czyli rozbicie jednej wizyty na dwie,
      z dwoma bonami w kuchni i dwoma paragonami.

      **Przenosi się wizyta, nie zamówienia** — wizyta jest jednostką rachunku, więc
      numer rachunku, uczestnicy, podział i historia zostają nietknięte. Numer stolika
      przepisujemy jednak **także na zamówieniach**, wbrew regule o nietykalnych
      snapshotach: cena w pozycji to fakt historyczny, a numer stolika to **adres, pod
      który kucharz niesie talerz**. Bon ze starym numerem oznaczałby jedzenie zaniesione
      pod stolik, przy którym siedzą już inni ludzie. Ślad zostaje w `OrderEvent`
      (nowa wartość `table_moved`), którego nigdy nie nadpisujemy.

      **Najtrudniejsza część jest po stronie gościa.** Token gościa leży w pamięci
      przeglądarki **pod kluczem kodu QR**, a wizyta ma teraz inny kod. Gość, który
      odświeży kartę sprzed przesiadki, trafiłby na wolny już stolik i dostałby tam nową
      wizytę z pustym rachunkiem — podczas gdy jego prawdziwy leżałby dwa stoliki dalej.
      Wejście rozpoznaje więc token przeniesionej wizyty i odsyła pod nowy adres, a
      aplikacja przenosi token pod nowy klucz. Warunek jest **wąski celowo**: sprawdzamy
      to wyłącznie wtedy, gdy przy skanowanym stoliku nie ma żadnej wizyty — przy zajętym
      skan wciąż znaczy „dosiadam się tutaj" i przysiadka do znajomych działa jak wcześniej.

      Odmawiamy przeniesienia na stolik zajęty (łączenie rachunków to osobna decyzja)
      i na wyłączony z użycia. Blokada **nie** blokuje: trwa dwie minuty po rozliczeniu
      i znaczy „sprzątamy", a kelner sadzający gości przy właśnie zwolnionym stole wie
      lepiej niż licznik. Stary stolik zwalnia się natychmiast, razem ze zdjęciem blokady —
      to jest sens tej operacji.
- [x] **Powrót do wizyty bez ponownego skanowania** (2026-08-27) — strona startowa
      aplikacji gościa sprawdza zapamiętane wizyty i przerzuca do menu, jeśli rachunek
      jest wciąż otwarty. Gość odzyskuje swój nick, znak i historię zamówień.

      **Przekierowanie wymaga potwierdzenia z serwera** (`POST /guest/resume`), nie samej
      obecności tokenu w przeglądarce. Wejście z nieaktualnym tokenem nie kończy się
      błędem — serwer zakłada wtedy nową tożsamość przy bieżącej wizycie stolika. Przy
      skanie to jest świadome „dosiadam się tutaj, teraz"; przy cichym przekierowaniu
      z zakładki byłoby dopisaniem gościa do cudzego rachunku bez jego wiedzy. Serwer
      sprawdza trzy warunki naraz: token jest jego, wizyta **ta sama** i sesja nieprzeterminowana.

      Rozstrzygnięcia z listy powyżej:
      - **bez ciasteczka.** Wystarczył `localStorage` i krótki komunikat „Sprawdzamy Twój
        stolik…" zamiast pokazywania „Zeskanuj kod QR", które za chwilę znika. Zysk poza
        prostotą: zostajemy w tym, co polityka prywatności **już opisuje** (token w pamięci
        lokalnej, technicznie niezbędny, bez banera zgody) — ciasteczko wymagałoby dopisku.
      - **wygasanie** — rozliczony rachunek i przeterminowana sesja prowadzą do ekranu
        skanowania. Nieaktualny wpis jest przy okazji kasowany z pamięci, żeby nie pytać
        o niego przy każdym kolejnym wejściu.
      - **kilka stolików** — sprawdzamy po kolei od ostatnio zapisanej wizyty.
      - **okno prywatne** — brak pamięci daje ekran skanowania **od razu**, bez pytania
        serwera o cokolwiek.
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

## 4a. Karta menu

- [x] **Zdjęcia dań** (2026-08-27) — jedno na pozycję, w planie Pro i wyższych,
      z możliwością ręcznego włączenia z zaplecza (§6c). Gość widzi miniaturę
      w karcie i pełne zdjęcie w szczegółach dania, z powiększeniem na cały ekran.

      **Jedno zdjęcie, nie galeria**: gość przegląda kartę, żeby wybrać, a nie
      żeby oglądać album — druga fotografia tego samego dania wydłuża listę
      i nie pomaga.

      Zmniejszanie dzieje się **w przeglądarce** przed wysłaniem (dłuższy bok do
      1400 px, JPEG): przeskalowanie po stronie API wymagałoby biblioteki
      natywnej w obrazie Dockera, a zysk byłby ten sam. Serwer i tak sprawdza
      rozmiar i **rzeczywisty typ pliku po zawartości**, nie po nagłówku.

      Pliki leżą na dysku serwera (wolumen `media`) za abstrakcją
      `MenuImageStorage` — docelowo S3/R2 z CDN-em, i wtedy zmienia się wyłącznie
      implementacja. **Wolumen trzeba backupować razem z bazą**: wiersz bez pliku
      to dziura w karcie, której nie da się odtworzyć.

---

## 5. System 1 — strona produktowa i sprzedaż

Pod `kelbroo.com` stoi `apps/web-marketing`. Rejestracja, sprzedaż abonamentu
i dokumenty prawne działają, a **wszystkie 33 odnośniki mają cel** (2026-08-26) —
klikając cokolwiek na stronie produktowej, użytkownik gdzieś trafia.

Zostaje jednak co innego: **cztery obietnice z cennika nie mają pokrycia w kodzie**
(§5f). Strona sprzedaje dziś za prawdziwe pieniądze, więc każda z nich jest albo
zadaniem, albo zdaniem do skreślenia — dwie pierwotne pozycje zamknięto już tym
drugim sposobem.

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
- [x] **PayU wśród odbiorców danych w polityce prywatności** (2026-08-27) — luka
      opisana w [legal/README.md §8](legal/README.md) jako najpilniejsza, bo dotyczyła
      **stanu faktycznego od uruchomienia sprzedaży**: przy każdym zakupie szedł do
      operatora adres e-mail i IP nabywcy, a §6 wymieniał wyłącznie Hostingera.

      §6 podaje teraz zakres przekazywanych danych i rozstrzyga rolę operatora:
      **PayU jest odrębnym administratorem**, nie procesorem, więc umowa powierzenia
      nie jest właściwym instrumentem. To nasze rozumienie, oznaczone jako do
      potwierdzenia przez prawnika. Sprawdzone przy okazji w kodzie: adresu IP
      **nie zapisujemy w bazie**, a pola na imię i nazwisko w wywołaniu zostają puste.
      Poprawiony też §9 ust. 3, który mówił o bramce płatności jako o funkcji przyszłej.

      **Zastąpione 2026-08-28** wersją od prawnika — patrz pozycja niżej.
- [x] **Regulamin: okres rozliczeniowy obejmuje płatność roczną** (2026-08-27) —
      §1 ust. 8 mówił „miesiąc kalendarzowy", a sprzedajemy też rok i liczymy okres
      **od dnia zakupu**, z przycięciem dnia do długości krótszego miesiąca. Poprawka
      poszła po stronie dokumentu, nie kodu: sposób liczenia jest uczciwszy dla klienta
      niż rozliczanie od pierwszego dnia miesiąca. Tabela w §5 ust. 2 ma kolumnę cen
      rocznych, a ust. 2a i 2b podają rabat i zakres samoobsługowego zakupu.

      **Ustępy 3–5 zostały nietknięte celowo** — stąd 2a i 2b zamiast przenumerowania:
      istniejące odwołania do §5 ust. 3 nie mogą zacząć wskazywać czego innego.
      Zrobione tym samym przeglądem co poprawka polityki, bo dwa osobne zawiadomienia
      klientów kosztowałyby dwa razy więcej niż jedno.
- [x] **Regulamin i Polityka w wersji od prawnika** (2026-08-28) — komplet odpowiedzi
      na pytania z części A–D [briefu](legal/pytania-do-prawnika.md) i nowe brzmienia obu
      dokumentów. **Rejestr rozbieżności z [legal/README.md §8](legal/README.md) jest
      zamknięty:** dokumenty opisują stan faktyczny.

      Co się zmieniło merytorycznie: **SLA nie udzielamy** i jest to napisane wprost;
      za kartę menu, alergeny, realizację zamówień i zwroty odpowiada **wyłącznie
      klient**; umowa powierzenia (DPA) jest wbudowana w regulamin, bez osobnego
      dokumentu do podpisu; wypowiedzenie idzie wyłącznie mailem; wsparcie techniczne
      wchodzi na konto klienta **na jego żądanie** i zostawia ślad w dzienniku.

      **Płatności gości dostały zielone światło przed budową, nie po** — środki idą
      wprost na konto klienta u operatora, więc świadczymy usługę techniczną i **nie
      potrzebujemy licencji KNF**. Regulamin §7 zawiera upoważnienie do przechowywania
      kluczy API klienta, a Polityka §2 — wyjątek na jednorazowy adres e-mail gościa.
      Obie kolizje domknięte, zanim powstała pierwsza linia kodu.

      Przy okazji drobiazg, który łatwo przeoczyć: **numer paragrafu z prawami RODO
      zmienił się z §8 na §7**, a odnośnik „RODO" w stopce prowadzi do kotwicy z numeru
      w nagłówku. Skrócenie dokumentu potrafi cicho rozwiązać taki odnośnik.

      **Zostaje czynność poza kodem:** zawiadomienie klientów z 14-dniowym wyprzedzeniem
      (§11 regulaminu, §8 polityki). Jedno pismo obejmuje tę zmianę **i tę z 27 sierpnia**,
      jeśli tamto jeszcze nie poszło.
- [x] **Bramka zgody przed analityką przywrócona** (2026-08-28) — obejście `POMIN_ZGODE`
      żyło tyle, ile weryfikacja usługi GA4 w Google, i **zostało usunięte w całości**,
      nie wyłączone. Sprawdzone ponownie w przeglądarce: zero żądań do Google przed
      zgodą i po odmowie, decyzja przeżywa odświeżenie, ruch rusza po zgodzie, a przycisk
      w stopce otwiera baner z powrotem.
- [x] **Polityka prywatności §3 rozdzielona** (2026-08-29) — zdanie „nie używamy
      narzędzi śledzących ani reklamowych" mówiło o całej platformie, a od czasu
      analityki na stronie produktowej przestało być prawdziwe.

      §3 mówi teraz osobno o dwóch miejscach: **w aplikacji Gościa** narzędzi śledzących
      nie ma i nie będzie, **na stronie produktowej** Google Analytics rusza wyłącznie
      po zgodzie, którą da się wycofać ze stopki. Dopisane wprost, że bez zgody nie
      ładujemy żadnego skryptu i nie wysyłamy niczego do Google — bo to właśnie
      odróżnia nasze rozwiązanie od typowego banera, który jedynie blokuje ciasteczka.

      Polityka ma wersję 2026-08-29; regulamin zostaje przy 2026-08-28.
      **Zawiadomienie klientów obejmuje teraz trzy wersje naraz** (27, 28 i 29 sierpnia)
      — jedno pismo, jeśli jeszcze nie poszło.
- [~] **⚠️ PRZYWRÓCIĆ cenę planu Starter** — obniżona 2026-09-01 ze **159 zł na 2 zł
      netto miesięcznie** (i z 1 590 zł na 20 zł rocznie), żeby dało się przejść
      **prawdziwą** płatność przez PayU za drobne. Zmiana obowiązuje **także na
      produkcji**, bo o to chodziło w teście.

      Dwie rzeczy do świadomości, dopóki to trwa:
      - **Każdy, kto trafi na cennik, może kupić Startera za 2,46 zł brutto.** Nie ma
        przełącznika „ceny testowe" — jest jedna cena i jest publiczna.
      - **Tabela cen w regulaminie (§5) podaje 159 zł** i przez ten czas nie zgadza się
        ze stanem faktycznym. Świadomie jej **nie zmieniałem**: zmiana ceny w regulaminie
        to nowa wersja dokumentu i kolejne 14-dniowe zawiadomienie klientów — za dużo
        jak na cenę, która ma żyć chwilę. Gdyby test miał potrwać dłużej niż kilka dni,
        trzeba to odwrócić: albo zmienić regulamin, albo cofnąć cenę.

      Przywrócenie: `netCents` w [plans.ts](../packages/types/src/plans.ts) na
      `{ month: 15_900, year: 159_000 }` i ceny wyświetlane w
      [Pricing.tsx](../apps/web-marketing/components/Pricing.tsx) na `159` / `132`
      oraz podpis „1 590 zł rocznie". Oba miejsca mają komentarz z docelowymi wartościami.
- [x] **Sygnał dźwiękowy przy nowej pracy** (2026-09-01) — zamówienie do potwierdzenia,
      wezwanie kelnera i nowy bon w kuchni. **Zamyka obietnicę ze strony produktowej**
      („alarm dźwiękowy" na kaflu ekranu kuchni), której rejestr §5f nie miał — druga
      taka po zestawieniu na e-mail, i znowu z prozy, nie z listy funkcji.

      **Liczony w powłoce, nie na ekranach.** Źródłem sygnału jest przyrost licznika
      przy pozycji menu, a te i tak żyją w powłoce — dzięki temu kelner na Sali słyszy
      zamówienie czekające w Powiadomieniach, bez osobnego nasłuchiwania na każdym
      ekranie. Gramy **wyłącznie przy wzroście**: spadek znaczy, że ktoś odebrał pracę,
      a pierwszy odczyt po wejściu milczy — inaczej otwarcie ekranu z pięcioma
      zamówieniami zaczynałoby się od dzwonka.

      **Preferencja na koncie, nie na urządzeniu** — kucharz staje przy tym tablecie,
      przy którym jest wolne miejsce. Odwrotnie niż paleta jasna/ciemna, która zostaje
      na urządzeniu.

      **Dźwięk jest generowany, nie odtwarzany z pliku.** Plik trzeba pobrać, a pierwsze
      zamówienie zmiany bywa pierwszym żądaniem po włączeniu tabletu — w lokalu
      z zawodnym wi-fi cisza wypadłaby dokładnie wtedy, gdy dźwięk jest najbardziej
      potrzebny.

      Przeglądarka nie zagra przed pierwszym dotknięciem ekranu i nie da się tego obejść.
      Zamiast milczeć, dzwonek pokazuje wtedy **pomarańczową kropkę** i mówi „stuknij,
      aby włączyć" — wymóg zapisany w [docs/02 §4](02-admin-panel.md).
- [ ] **Anonimizacja konta po 6 miesiącach + powiadomienie 30 dni wcześniej** —
      **nowe zobowiązanie z dokumentów 2026-08-28** i najpoważniejsza rzecz, jaką te
      dokumenty zostawiły do zrobienia. Żaden mechanizm retencji nie istnieje.

      Zmiana z „usuwamy" na „anonimizujemy" jest dla nas korzystniejsza — statystyki
      zostają — ale **dokłada obowiązek**, którego wcześniej nie było: wysyłkę
      powiadomienia z wyprzedzeniem. Pierwszy termin zapadnie sześć miesięcy po
      pierwszym wygasłym koncie, więc czasu jest sporo, a przeoczyć go łatwo.
- [ ] **Ślad w dzienniku przy wejściu wsparcia na konto klienta** — regulamin §3 ust. 3
      to obiecuje. Funkcji „wejdź na konto klienta" **nie ma wcale**, więc dziś nikt nią
      nie wchodzi i zapis jest prawdziwy. Ale gdy powstanie (§6 zaplecza), dziennik ma
      powstać **razem z nią**, a nie po niej.
- [ ] **Domknąć pozostałe obietnice bez pokrycia w kodzie** — spis w
      [docs/legal/README.md §8](legal/README.md).
- [x] **NIP przy rejestracji** (2026-08-24) — ze sprawdzeniem sumy kontrolnej po obu
      stronach. **Adres firmy zbieramy od 2026-08-26** — jest polem obowiązkowym przy
      zakupie abonamentu, bo faktura VAT bez adresu nabywcy nie jest fakturą.

### 5d. Pozostałe treści z odnośników

- [x] **Demo menu** (`#demo`) (2026-08-26) — publiczna restauracja pokazowa pod
      `/t/demo`, otwierana **kodem QR na stronie**, nie przyciskiem (2026-08-27):
      tak wygląda ta usługa naprawdę — gość siada, wyjmuje telefon i skanuje.
      Przycisk otwierałby menu na monitorze, czyli na urządzeniu, na którym nikt
      z tego nie korzysta. Kod jest zarazem odnośnikiem, bo czytający stronę
      na telefonie nie zeskanuje własnego ekranu. Rysowany przy budowaniu strony,
      więc statyczna strona nie wozi biblioteki dla stałego adresu. zakładana skryptem `scripts/seed-public-demo.ts`. Oddzielona od
      klientów flagą `Organization.isDemo`: nie liczy się w statystykach zaplecza
      i nie dostaje przypomnień o abonamencie. Potwierdzanie przez kelnera jest w niej
      wyłączone, bo żadnego kelnera tam nie ma — z włączonym zwiedzający zobaczyłby
      zamówienie wiszące w nieskończoność. Gość widzi u góry pasek, że to demonstracja.
      Wizyty starsze niż 30 minut kasuje zadanie cykliczne. Od 2026-08-27 karta
      pokazowa ma **zdjęcia wszystkich dziesięciu dań** — wgrywa je ten sam skrypt,
      z plików trzymanych w repozytorium już zmniejszonych (dłuższy bok 1400 px,
      ~160 kB zamiast ~1,8 MB oryginału). Brak dopasowania nazwy pliku do dania
      **przerywa skrypt**: po cichu pominięte zdjęcie zauważyłby dopiero ktoś,
      kto zajrzy do demo.
- [x] **Baza wiedzy** (2026-08-26) — `/pomoc` ze spisem i sześcioma artykułami:
      pierwsze kroki, karta menu, stoliki i kody QR, obsługa zamówień na zmianie,
      konta pracowników, abonament i faktury.

      Treść leży w `docs/pomoc/*.md` i przechodzi tym samym potokiem co dokumenty
      prawne — w repozytorium, pod przeglądem, renderowana przy budowaniu. Powód
      jest jeden: **instrukcja rozjechana z produktem jest gorsza niż jej brak**,
      a trzymana obok kodu ma szansę zmienić się razem ze zmianą w panelu.
      Etykiety w artykułach przepisane ze zrzutów prawdziwych ekranów, nie z pamięci.
- [x] **Pięć segmentów na jednej stronie** (2026-08-26) — `/dla-kogo` z kotwicami
      `#restauracje`, `#kawiarnie`, `#bary`, `#hotele`, `#sieci`. Wybrane zamiast pięciu
      podstron: treść jest w dużej części wspólna i pięć kopii rozjechałoby się przy
      pierwszej zmianie w produkcie. **Ceną jest słabsze pozycjonowanie** pod pojedyncze
      hasła — sekcje da się rozdzielić później bez przepisywania treści.

      Każdy segment zaczyna się od **obiekcji**, nie od korzyści: restaurator czytający
      taką stronę ma już w głowie powód, dla którego to u niego nie zadziała.
      Przy okazji nagłówek i stopka trafiły do wspólnych komponentów, a ich kotwice
      liczą się od korzenia — inaczej z podstrony nie prowadziłyby donikąd.

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

### 5f. Obietnice ze strony bez pokrycia w kodzie

Rejestr sporządzony 2026-08-26 przez porównanie cennika, siatki funkcji i FAQ ze
stanem kodu. **Dziesięć pozycji, z czego dziewięć zamkniętych:** trzy
skreśleniem obietnicy (praca offline, instalacja, płatność gościa w aplikacji —
ta ostatnia wraca razem z kodem), pięć dopisaniem brakującego kodu (limit kont
personelu, oceny dań, limit pozycji w karcie, zestawienie rachunku na e-mail,
podział po pozycjach, sygnał dźwiękowy w kuchni).

**Dziesiąta doszła 2026-09-01 i powtarza lekcję z dziewiątej.** „Alarm dźwiękowy"
stoi na kaflu ekranu kuchni od pierwszej wersji strony, a audyt go nie policzył —
bo szedł po nagłówkach kafli, nie po zdaniach w środku. Drugi raz z rzędu brakująca
obietnica siedziała w prozie.

**Dziewiąta pozycja doszła 2026-08-27 i warto wiedzieć dlaczego jej nie było.**
Pierwszy audyt szedł po kaflach funkcji i po tabeli cennika — a obietnica
zestawienia na e-mail siedzi w **prozie sekcji o podziale rachunku**, zdaniem
w środku akapitu. Następny przegląd strony ma czytać także zdania, nie tylko
listy i nagłówki. Odpowiednik [§8 z docs/legal](legal/README.md), tyle
że dla obietnic handlowych: strona sprzedaje za prawdziwe pieniądze, więc każda
z tych pozycji jest albo zadaniem do zrobienia, albo zdaniem do skreślenia.

Kolejność według tego, ile kosztuje odkrycie braku przez klienta, który już zapłacił.

- [x] **FAQ: praca offline — obietnica skreślona** (2026-08-26). Nie budujemy pracy
      bez sieci: kolejkowanie akcji kelnera brzmi atrakcyjnie przy zawodnym wi-fi, ale
      rozjazd między tym, co widzi kuchnia, a tym, co czeka na tablecie, kosztuje więcej
      niż daje. FAQ, baza wiedzy, `docs/02`, `docs/03`, `product.md` i CLAUDE.md mówią
      teraz zgodnie, że kelbroo wymaga połączenia.
- [x] **FAQ: instalacja na ekranie głównym — obietnica skreślona** (2026-08-26).
      Panel i aplikacja gościa otwierają się pod adresem w przeglądarce. Przy okazji
      z planu wypadły **aplikacje natywne** (`apps/mobile-guest`): cała ich wartość
      wymagała konta gościa, a konto gościa jest dokładnie tym, czego kelbroo nie chce.
- [x] **Starter: „oba modele płatności" — obietnica zdjęta ze strony** (2026-08-26).
      Płatność gościa w aplikacji (`prepaid`) należy do etapu 2 i **wróci na stronę
      razem z kodem**. Zdjęta została karta „Płatność w aplikacji" z sekcji `#modele`,
      poprawiony nagłówek sekcji, cecha planu Starter w cenniku i odpowiedź w FAQ.
      W miejscu karty stoi zdanie, że przygotowujemy tę płatność — bo pytają o nią
      klienci i milczenie byłoby gorsze niż „jeszcze nie".
- [x] **„Oceny dań i feedback do managera" — zbudowane i zamknięte w planie Pro**
      (2026-08-27, §4). Podział „podstawowe/pełne" **skreślony**: nic go nie definiowało,
      a definiowanie różnicy po to, żeby ją sprzedać, byłoby wymyślaniem ograniczenia.
      Jedna wersja, w Pro i wyżej; w niższych planach domyślnie wyłączona i nieopisana
      w cenniku, z możliwością ręcznego włączenia z zaplecza (§6c).
- [x] **„Zestawienie »kto co zamówił« na e-mail" — zbudowane** (2026-08-27).
      Obietnica z sekcji o podziale rachunku, w czasie teraźniejszym, sprzedawana
      od pierwszej wersji strony i **pominięta przez pierwszy audyt** (patrz wyżej).
      Szczegóły w §4.
- [ ] **Pro: „Analityka i eksport raportów".**
      Zero kodu, także w panelu. Obiecane kafelkiem „Raporty i analityka".
      To najbardziej rozbudowana pozycja z całej listy.
- [x] **Pro: podział rachunku „po pozycjach"** (2026-08-27). Domyka ostatnią
      rozbieżność między `product.md` a kodem: dokument mówił „po pozycjach", a tryb
      nie istniał.

      **Okazał się nie nową strukturą płatności, tylko doprecyzowaniem atrybucji.**
      Rozliczenie nadal idzie przez `SettlementGroup` (grupy jednoosobowe, jak
      `per_person`); zmienia się wyłącznie **źródło kwoty uczestnika** — `OrderItemShare`
      zamiast samego `for_participant_id`. Dlatego `planSplit` nie dostał osobnej gałęzi:
      druga gałąź to drugie miejsce, w którym rachunek może przestać się sumować.

      **Powód odłożenia przestał obowiązywać.** Zapisany był jako „najbardziej złożona
      arytmetycznie część", a arytmetyka — największe reszty, deterministyczna kolejność,
      niezmiennik — leżała gotowa i przetestowana w `packages/types` od początku.

      Rozstrzygnięcia:
      - **Przypisuje kelner, nie gość.** Rozmowa „kto brał wino?" toczy się przy stoliku,
        a układanie dwudziestu pozycji palcem na telefonie, przez pięć osób naraz i na
        wspólnym stanie, byłoby najgorszym pierwszym wariantem. Ekran gościa da się
        dołożyć później bez zmiany modelu.
      - **Udziały w częściach, nie w kwotach** — trzy piwa na dwie osoby to 2:1.
      - **Pozycja jednej osoby nie zakłada wierszy udziału** — zostaje przy
        `for_participant_id`. Im mniej wierszy, tym mniej miejsc na rozjazd.
      - **Udziały przeżywają dokładkę**, bo żyją na pozycji zamówienia, a nie na grupie.
        Nowe danie wchodzi jako nieprzypisane i **blokuje rozliczenie** — ciche doliczenie
        go hostowi to błąd, którego nikt nie zauważy przed zamknięciem zmiany.

      Test niezmiennika miał najpierw **fałszywe zęby**: sprawdzał sumę grup, a ta zgadza
      się także wtedy, gdy udziały są ignorowane — pominięta pozycja wpada wtedy do puli
      dzielonej po równo (45/45 zamiast 60/30). Rozstrzyga dopiero kwota **konkretnej**
      grupy.
- [x] **Limit kont personelu — egzekwowany** (2026-08-26). Menu 1, Starter 3,
      Pro i Enterprise bez limitu; wartość siedzi na abonamencie, więc zaplecze może
      ją podnieść pojedynczemu klientowi. Liczą się **konta czynne** — wyłączone
      zostają w bazie, bo zamówienia są nimi podpisane, a doliczanie ich karałoby
      lokal za rotację pracowników. Sprawdzenie jest w transakcji, żeby dwa
      równoczesne zakładania nie przecisnęły się obok jednego wolnego miejsca.
      Istniejące konta ponad limit **zostają** — blokujemy zakładanie nowych,
      nie odbieramy dostępu.
- [x] **Limit pozycji w karcie — egzekwowany** (2026-08-27). Menu 10, Starter 50,
      Pro i Enterprise bez limitu. **Cennik przy okazji został zacieśniony**: obiecywał
      50 pozycji w planie Menu i brak limitu w Starterze — sprawdzone przed zmianą,
      żaden istniejący lokal nie przekraczał nowych progów. Liczą się wyłącznie
      pozycje **w karcie**: wycofane zostają w bazie, bo wiszą na nich historyczne
      rachunki, ale miejsca w planie nie zajmują — inaczej lokal po roku pracy
      uderzałby w limit, nie mając w menu ani jednej pozycji więcej. Wartość siedzi
      na abonamencie (`subscription.menu_item_limit`), więc zaplecze podnosi ją
      pojedynczemu klientowi bez zmiany cennika i bez wdrożenia; **zmiana planu
      kasuje taki wyjątek**. Sprawdzenie jest w transakcji dodawania pozycji.

> **Enterprise** obiecuje wiele lokali, integrację z kasą i POS oraz własną domenę
> i branding. Żadnej z tych rzeczy nie ma, ale plan nie jest samoobsługowy —
> każdy taki klient przechodzi przez rozmowę, w której zakres ustala się wprost.
> Kolumny `logoUrl` i `theme` czekają w schemacie bez interfejsu i bez użycia.

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

- [x] **Włączanie funkcji poza planem** (2026-08-27) — dziś dwie: zdjęcia dań
      i oceny gości. Wartość siedzi na abonamencie, więc zaplecze może ją nadać
      lokalowi na Starterze na czas rozmowy o przejściu na Pro, nie ruszając
      abonamentu. **Zmiana planu kasuje taki wyjątek** — plan jest wtedy świeżą
      decyzją i ustawia funkcje na wartości z cennika; panel mówi o tym wprost
      przy przycisku. Każde przełączenie wymaga powodu i trafia do dziennika.

- [x] **Limity planu** (2026-08-26) — widoczne na karcie i przestawiane razem
      ze zmianą planu.
- [ ] **Ustawienia lokalu z poziomu wsparcia** — te same przełączniki, które ma manager
      (tryb zamawiania, potwierdzanie, zgoda hosta, rozliczanie po jednym).
- [ ] **Przełączniki funkcji per klient** — pilotaż nowej funkcji u jednego lokalu bez
      wypuszczania jej wszystkim. Dziś każda taka decyzja to wdrożenie całej aplikacji.
- [x] **Nadpisanie limitu ponad plan** (2026-08-27) — cztery pola na karcie klienta:
      pozycje w karcie, stoliki, języki, konta personelu. Sieć na 45 stolikach przy planie
      na 40 dostaje zgodę handlową, a nie awarię w piątek wieczorem; lokal z kartą na
      55 pozycji nie musi przechodzić na Pro dlatego, że przekroczył próg o pięć dań.
      Każda zmiana wymaga powodu i trafia do dziennika (`subscription.limits_changed`).
      **Zmiana planu kasuje wyjątek** — tak samo jak przy funkcjach; panel mówi o tym
      pod formularzem, bo inaczej byłaby to pułapka.

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

- [x] **Test e2e przesiadki** (2026-08-27) — `table-move.spec.ts`. Funkcja rozciąga się
      na trzy aplikacje naraz, a jej najtrudniejsza część dzieje się w `localStorage`
      przeglądarki, gdzie test jednostkowy nie sięga.

      **Pierwsza wersja nie miała zębów.** Sprawdzała, że gość po powrocie widzi swoje
      zamówienie — a to widać także wtedy, gdy zostanie dopisany jako **nowa osoba** do
      tego samego rachunku, bo rachunek jest wspólny. Test przechodził z wyłączonym
      przenoszeniem tokenu. Rozstrzyga dopiero liczba gości przy stoliku, widoczna
      w panelu: bez przeniesienia tokenu jest ich dwóch zamiast jednego.

      Druga pułapka była w samym teście: kafel stolika wskazywany po dowolnym tekście
      trafiał **w dwa kafle naraz**, bo rozwinięta lista przesiadki niesie nazwy wolnych
      stolików jako opcje. Wychodziło to wyłącznie przy pełnym przebiegu, pod obciążeniem —
      w pojedynczym test przechodził. Kafel wskazujemy teraz po nagłówku.
- [x] **Testy e2e ścieżki gościa: zamawianie** (2026-08-27) — `guest-ordering.spec.ts`:
      koszyk z ilością i notatką, złożenie zamówienia, kolejka potwierdzeń, ekran kuchni
      po obu stronach bramki, tryb bez potwierdzania i rozliczenie stolika przez kelnera.

      **Pierwsza wersja tego testu była fałszywie zielona.** Sprawdzenie „zamówienia nie
      ma na kuchni" wykonane tuż po nawigacji przechodzi na jeszcze pustej stronie
      i nie dowodzi niczego. Poprawione dwoma sposobami: najpierw pozytywna asercja,
      że zamówienie w ogóle dotarło do panelu, potem czekanie na wyrenderowany ekran
      kuchni. Zęby sprawdzone przez zepsucie `statusAfterSubmission` — test pada.

      Przy okazji wyszło, że bramka jest **podwójna**: filtruje i zapytanie serwera,
      i grupowanie kolumn w panelu. Zepsucie samego zapytania nie zmienia tego,
      co widać.
- [~] **Niestabilny pełny przebieg e2e — jeden test na przebieg** (obserwowane
      2026-08-27, trzykrotnie). **Za każdym razem inny test** i za każdym razem taki,
      którego akurat nie zmienialiśmy. Trzeci przypadek podał przyczynę wprost:
      `deadlock detected` w **sprzątaniu po teście**, przy `DELETE FROM table_session` —
      test przeszedł, przewróciło go dopiero porządkowanie danych. Fixture kasuje
      wiersze, które żyjąca obok aplikacja akurat czyta.

      **Dwie przyczyny domknięte, jedna otwarta.** Sprzątanie fixture'ów ponawia się
      po zakleszczeniu (trzy próby, potem błąd leci dalej — utrzymujące się zakleszczenie
      znaczy coś innego niż zbieg okoliczności). Osobno wyszła **losowa** wpadka
      w `waiter-ordering`: asercja `getByText('2')` na liczniku ilości trafiała czasem
      w nazwę dania, bo ta jest losowa i bywa z dwójką („Danie b227"). Naprawione
      przez `exact`.

      Zostają dwa 60-sekundowe timeouty z 2026-08-27 (`session-orders`, `password`),
      których **nie odtworzyłem i nie wyjaśniłem**. Mogą mieć wspólną przyczynę
      z zakleszczeniem — rywalizację o blokady w bazie — ale to hipoteza. Do obserwacji
      na CI, gdzie obciążenie jest powtarzalne.
- [ ] **Dostępność WCAG 2.1 AA** w aplikacji gościa — używa jej przypadkowa publiczność.
- [x] ~~**Buforowanie offline w panelu.**~~ **Skreślone 2026-08-26** (§5f). kelbroo
      wymaga połączenia i mówi o tym wprost na stronie i w bazie wiedzy.
- [ ] **Menu gościa < 2 s na 4G** — zmierzyć na produkcji, nie zakładać.
- [x] **Alarmy wewnętrzne** (2026-08-27) — API zgłasza pocztą to, co psuje usługę
      po cichu: padniętą bazę, padnięty Redis, wywrócone zadanie cykliczne, odmowę
      operatora płatności i nieudany zakup abonamentu. Adres z `MAIL_NOTIFY`.

      **Redis jest tu najważniejszym z czujników i najmniej oczywistym.** Gdy padnie,
      nie ma żadnego błędu — panele po prostu przestają dostawać zdarzenia na żywo,
      a obsługa bierze ciszę za brak zamówień. Baza przeciwnie: wszystko się wywala,
      ale serwer nadal odpowiada, więc z zewnątrz wygląda na sprawny.

      **Wyciszanie powtórzeń jest częścią mechanizmu, nie ozdobnikiem.** Zepsuta
      konfiguracja PayU wysyłałaby alarm co dziesięć minut — sto czterdzieści cztery
      dziennie. Skrzynka zalana jednym alarmem przestaje być czytana dokładnie wtedy,
      gdy przyjdzie drugi, inny. Stąd godzina ciszy i jedna zbiorcza wiadomość
      z liczbą wystąpień, plus odwołanie alarmu, gdy awaria ustąpi.

      `/api/health` **zwraca teraz 503 przy awarii** — wcześniej oddawał `200`
      z `degraded` w treści, co dla dowolnego monitora znaczy „sprawny". Fałszywy
      spokój jest gorszy od braku monitorowania.

      Przy pierwszym uruchomieniu czujnik Redisa zgłaszał **fałszywy alarm** przy
      starcie (sonda szła przed nawiązaniem połączenia). Wyszło to dopiero po
      uruchomieniu API, nie w testach — stąd sprawdzenie na żywo w procedurze
      wdrożenia.
- [ ] **Monitor spoza serwera** — jedyna rzecz, której alarmy wewnętrzne nie zrobią:
      **martwy proces nie wyśle wiadomości o własnej śmierci**. To samo dotyczy
      padniętej maszyny, zatrzymanego Dockera i wygasłego certyfikatu. Potrzebna
      usługa odpytująca `https://menu.kelbroo.com/api/health` co minutę i alarmująca
      na kod inny niż 200 — konfiguracja, nie kod. Do wybrania dostawca (UptimeRobot,
      Better Stack, healthchecks.io) i kanał powiadomienia inny niż nasza własna
      poczta, bo ta stoi na tym samym serwerze.

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
