# System 2 — Panel zarządzania restauracją i realizacji zamówień

> Aplikacja: `apps/web-admin` · Next.js · Odbiorcy: właściciel, manager, kelner, kuchnia
> Urządzenia: przeglądarka desktop, iPad (Safari), tablet Android (Chrome) — jedna aplikacja webowa, bez instalacji
> Kontekst: [product.md](product.md) · [architecture.md](architecture.md)

## 1. Cel

Jedno miejsce, w którym restauracja: rozlicza abonament, konfiguruje lokal i stoliki, generuje kody QR, prowadzi wielojęzyczne menu, obsługuje napływające zamówienia i analizuje wyniki oraz feedback gości.

## 2. Role i uprawnienia (RBAC)

| Uprawnienie | Owner | Manager | Kelner | Kuchnia |
|---|:--:|:--:|:--:|:--:|
| Zarządzanie abonamentem i płatnościami | ✅ | ❌ | ❌ | ❌ |
| Zarządzanie personelem i rolami | ✅ | ✅ | ❌ | ❌ |
| Ustawienia restauracji, branding | ✅ | ✅ | ❌ | ❌ |
| Zarządzanie stolikami i kodami QR | ✅ | ✅ | ❌ | ❌ |
| Edycja menu, cen, tłumaczeń | ✅ | ✅ | ❌ | ❌ |
| Oznaczanie dania jako niedostępne (86) | ✅ | ✅ | ✅ | ✅ |
| Podgląd i obsługa zamówień | ✅ | ✅ | ✅ | ✅ |
| Potwierdzanie / odrzucanie zamówień gości | ✅ | ✅ | ✅ | ⚠️ opcjonalnie |
| Składanie zamówienia w imieniu gościa | ✅ | ✅ | ✅ | ❌ |
| Edycja zamówienia przed startem kuchni | ✅ | ✅ | ✅ | ❌ |
| Edycja zamówienia po starcie kuchni | ✅ | ✅ | ⚠️ tylko dodawanie | ❌ |
| Podgląd pełnej historii zmian zamówienia | ✅ | ✅ | ⚠️ skrócona | ❌ |
| Otwieranie wizyty przy stoliku | ✅ | ✅ | ✅ | ❌ |
| Zarządzanie podziałem rachunku | ✅ | ✅ | ✅ | ❌ |
| Rozliczanie rachunku (przyjęcie płatności) | ✅ | ✅ | ✅ | ❌ |
| Rabaty i korekty rachunku | ✅ | ✅ | ⚠️ do limitu | ❌ |
| Anulowanie zamówienia / zwrot płatności | ✅ | ✅ | ❌ | ❌ |
| Raporty sprzedaży | ✅ | ✅ | ❌ | ❌ |
| Podgląd ocen i feedbacku | ✅ | ✅ | ⚠️ własne | ⚠️ dot. kuchni |
| Wiele lokali (Enterprise) | ✅ | ⚠️ przypisane | ❌ | ❌ |

Kelnerzy i kuchnia logują się na uproszczonym ekranie (kod PIN na wspólnym tablecie zamiast e-mail+hasło) — istotne przy zmianowej pracy na jednym urządzeniu.

## 3. Moduły

### 3.1 Onboarding (kreator po zakupie)

Kroki, z paskiem postępu i możliwością powrotu:
1. Dane restauracji — nazwa, adres, typ lokalu, strefa czasowa, waluta, godziny otwarcia.
2. **Tryb zamawiania** — kluczowy wybór: płatność w aplikacji, płatność u kelnera, czy decyzja gościa (§3.4). Kreator zadaje pytanie językiem restauratora („Jak Twoi goście mają płacić?"), a nie nazwami technicznymi, i pokazuje konsekwencje każdego wyboru.
3. Branding — logo, kolor przewodni, zdjęcie tła menu.
4. Języki — język domyślny + języki dodatkowe (limit wg planu).
5. Stoliki — liczba stolików / import listy / strefy (sala, taras, bar).
6. Menu — utworzenie od zera, import z CSV lub wybór szablonu startowego.
7. Personel — zaproszenie kelnerów i kuchni (e-mail lub kody PIN).
8. Kody QR — wygenerowanie i pobranie PDF do wydruku.
9. Test — złożenie testowego zamówienia, które przechodzi przez cały przepływ aż do rozliczenia rachunku.

### 3.2 Dashboard (pulpit)

- Kafelki na dziś: liczba zamówień, obrót, średnia wartość zamówienia, średni czas realizacji, średnia ocena.
- Wykres sprzedaży (dzień/tydzień/miesiąc) z porównaniem do poprzedniego okresu.
- Top 5 najczęściej zamawianych dań i 5 najgorzej ocenianych.
- Alerty: zamówienia oczekujące dłużej niż X minut, dania oznaczone jako niedostępne, kończący się trial/nieopłacona faktura.

### 3.3 Zarządzanie abonamentem

- Aktualny plan, status, data następnego odnowienia, wykorzystanie limitów (stoliki X/Y, języki X/Y).
- Zmiana planu (upgrade natychmiast, downgrade od następnego okresu), anulowanie.
- Historia płatności i pobieranie faktur VAT.
- Zarządzanie metodą płatności (Stripe Customer Portal).
- Dane do faktury (nazwa firmy, NIP, adres).
- Blokada funkcji po wygaśnięciu abonamentu: **menu gościa przechodzi w tryb tylko do odczytu, zamawianie wyłączone** — nigdy nie kasujemy danych klienta.

### 3.4 Zarządzanie restauracją i stolikami

- Ustawienia lokalu: dane, godziny otwarcia, strefy czasowe, waluta, stawki VAT.

#### Tryb zamawiania i płatności

Najważniejszy ekran konfiguracyjny lokalu — determinuje wygląd aplikacji gościa i przepływ pracy obsługi. Opis modelu: [product.md §5.6](product.md#56-tryby-zamawiania-i-płatności-wybór-restauracji).

- **Wybór trybu** (`ordering_mode`) prezentowany jako trzy karty z opisem konsekwencji, nie jako lista rozwijana:
  - **Płatność w aplikacji** (`prepaid`) — gość płaci przy zamawianiu, zamówienie idzie do kuchni po potwierdzeniu płatności.
  - **Płatność u kelnera** (`pay_at_table`) — brak płatności w aplikacji, gość tylko zamawia, rachunek rozliczany po konsumpcji na kasie lokalu.
  - **Gość wybiera** (`guest_choice`) — obie opcje dostępne przy składaniu zamówienia.
- Przy każdym trybie widoczna informacja o skutkach: opłaty transakcyjne, wymogi fiskalizacji, ryzyko nieopłaconych rachunków.
- **Potwierdzanie zamówień przez obsługę** (`require_staff_confirmation`) — przełącznik niezależny od trybu. Włączony: zamówienie gościa trafia najpierw na ekran „Powiadomienia" w panelu kelnera. Domyślnie włączony dla `pay_at_table`, wyłączony dla `prepaid`; przy zmianie trybu panel proponuje domyślną wartość, ale nie nadpisuje decyzji managera bez pytania.
- **Otwieranie stolika przez obsługę** (`table_activation_required`) — gość może zamawiać dopiero po otwarciu wizyty przez kelnera. Opcja dla lokali o podwyższonym ryzyku.
- **Limit otwartego rachunku** (`open_bill_limit_cents`) — po przekroczeniu progu kolejne zamówienia zawsze wymagają potwierdzenia.
- **Napiwki** — włączone/wyłączone, sugerowane wartości procentowe. Niedostępne w trybie `pay_at_table` (napiwek zostawiany kelnerowi bezpośrednio) — panel jasno to komunikuje zamiast ukrywać opcję bez wyjaśnienia.
- **Fiskalizacja** (`fiscalization_mode`) — wybór ścieżki: brak (rozliczenie na kasie lokalu) / integracja z kasą lokalu / kasa wirtualna. Opis opcji: [architecture.md §12](architecture.md#12-fiskalizacja-i-paragony-polska).
- Pozostałe: minimalna wartość zamówienia, możliwość zamawiania po zamknięciu kuchni, automatyczne wygaszanie porzuconych wizyt (po ilu godzinach).

**Wymóg UX:** zmiana trybu zamawiania jest operacją wysokiego ryzyka w działającym lokalu. Panel musi ostrzec, że zmiana wpłynie na wszystkie stoliki, i zablokować ją przy otwartych, nierozliczonych wizytach.
- **Stoliki:** lista z filtrowaniem, dodawanie pojedynczo i masowo ("dodaj stoliki 1–20"), strefy, liczba miejsc, aktywacja/dezaktywacja.
- **Kody QR:**
  - Generowanie unikalnego, niezgadywalnego tokenu per stolik.
  - Podgląd QR z brandingiem restauracji (logo w środku, kolor, tekst "Zeskanuj i zamów").
  - Eksport: pojedynczy PNG/SVG, arkusz PDF do wydruku (A4, konfigurowalny układ: naklejki, stojaki na stolik, karty).
  - **Regeneracja tokenu** (gdy QR wyciekł/został podmieniony) z ostrzeżeniem, że stare wydruki przestaną działać.
  - Statystyki skanów per stolik (który stolik generuje najwięcej zamówień).

### 3.5 Zarządzanie menu (wielojęzyczne)

- **Kategorie** — kolejność (drag & drop), widoczność, dostępność czasowa (np. śniadania 8:00–11:00).
- **Dania** — nazwa, opis, cena, VAT, zdjęcie (upload z automatycznym kadrowaniem i kompresją), czas przygotowania, kaloryczność.
- **Alergeny i tagi dietetyczne** — lista zgodna z wymogami UE (14 alergenów), tagi: wegetariańskie, wegańskie, bezglutenowe, ostre, nowość, polecane.
- **Modyfikatory** — grupy opcji (np. "Wybierz sos" min 1 max 1, "Dodatki" min 0 max 5) z dopłatami; przypisywane do dań lub współdzielone.
- **Dostępność** — szybki przełącznik "niedostępne dziś" (tzw. 86), dostępny również dla kelnera i kuchni; danie znika z menu gościa natychmiast.
- **Zestawy/menu dnia** — kompozycje dań w stałej cenie (faza 2).
- **Edytor tłumaczeń:**
  - Widok tabelaryczny: wiersze = dania, kolumny = języki, z podświetleniem brakujących tłumaczeń.
  - Wskaźnik kompletności tłumaczeń per język ("Menu EN: 87% przetłumaczone").
  - Fallback na język domyślny, jeśli brak tłumaczenia (gość nigdy nie widzi pustego pola).
  - Faza 2: propozycje tłumaczeń AI wymagające akceptacji managera przed publikacją.
- **Podgląd na żywo** — panel obok edytora pokazuje, jak menu wygląda na telefonie gościa, w wybranym języku.
- **Import/eksport CSV** — masowe wprowadzanie i aktualizacja cen.
- **Historia zmian cen** — audit log (kto, kiedy, z jakiej na jaką cenę).

### 3.6 Panel realizacji zamówień — widok Kuchnia (KDS)

Ekran zaprojektowany pod tablet w orientacji poziomej, obsługę w rękawiczkach i odczyt z odległości.

- **Układ kolumnowy (kanban):** `Nowe` (status `confirmed`) → `W przygotowaniu` → `Gotowe`.
- Do KDS trafiają **wyłącznie zamówienia potwierdzone** — kuchnia nigdy nie widzi zamówień oczekujących na płatność ani na potwierdzenie kelnera. Bramkę opisuje [architecture.md §6.1](architecture.md#61-maszyna-stanów-zamówienia).
- Karta zamówienia zawiera: numer zamówienia, numer stolika, czas od złożenia (licznik rosnący), listę pozycji z modyfikatorami i uwagami gościa.
- **Kolorowanie po czasie:** zielony < 10 min, żółty 10–20 min, czerwony > 20 min (progi konfigurowalne) — natychmiastowa informacja, co się opóźnia.
- **Sygnał dźwiękowy** przy nowej pracy do podjęcia *(2026-09-01)* — zamówienie do potwierdzenia, wezwanie kelnera, nowy bon w kuchni. Wyciszany dzwonkiem w nagłówku, preferencja zapisana **na koncie pracownika**, nie na urządzeniu. **Wibracji i regulacji głośności nie ma:** wibracja wymaga uprawnień, których przeglądarka nie daje bez instalacji, a głośnością steruje się na tablecie. Sygnał odzywa się wyłącznie przy **przyroście** pracy.
- Akcje: `Przyjmij`, `Rozpocznij przygotowanie`, `Oznacz jako gotowe`, `Oznacz pozycję jako gotową` (dania mogą być gotowe pojedynczo), `Zgłoś problem` (brak składnika → automatyczne oznaczenie dania jako niedostępne + powiadomienie kelnera).
- Duże pola dotykowe (min. 48×48px), wysoki kontrast, tryb ciemny do pracy przy słabym oświetleniu.
- Ekran nie wygasza się podczas pracy (Wake Lock API).
- ~~**Praca offline:** akcje kolejkowane lokalnie i synchronizowane po powrocie sieci.~~
  **Skreślone 2026-08-26.** Panel wymaga połączenia. Kolejkowanie akcji kelnera brzmi
  atrakcyjnie przy zawodnym wi-fi, ale rozjazd między tym, co widzi kuchnia, a tym, co
  czeka w kolejce na tablecie, kosztuje więcej niż daje. Zamiast tego panel mówi wprost,
  że stracił połączenie.

### 3.7 Panel realizacji zamówień — widok Kelner

- **Mapa/lista stolików** z kolorowym statusem: wolny, wizyta otwarta, **zamówienie do potwierdzenia**, w przygotowaniu, **gotowe do wydania**, przywołanie kelnera, **rachunek do rozliczenia**.
- Na kaflu stolika: czas trwania wizyty, liczba zamówień, **bieżąca kwota rachunku** — kelner musi widzieć wartość otwartego rachunku bez wchodzenia w szczegóły.
- **Ekran „Powiadomienia"** (gdy `require_staff_confirmation` włączone) — zamówienia oczekujące na weryfikację przy stoliku:
  - Karta z numerem stolika, pozycjami, modyfikatorami, uwagami gościa i kwotą.
  - Akcje: `Potwierdź` (→ zamówienie idzie na kuchnię), `Edytuj i potwierdź` (korekta ilości/pozycji po rozmowie z gościem), `Odrzuć` z obowiązkowym powodem.
  - Licznik czasu oczekiwania — gość widzi w aplikacji „czeka na potwierdzenie" i każda minuta zwłoki to zła obsługa. Alert po przekroczeniu progu (domyślnie 2 min).
- **Otwieranie wizyty przy stoliku** (gdy `table_activation_required`) — akcja `Otwórz stolik`, opcjonalnie z liczbą gości.
- **Przesadzenie gości** — akcja `Przesadź gości` przenosi całą wizytę pod inny wolny stolik: rachunek, uczestnicy, podział i złożone zamówienia. Przenosi się **wizyta**, bo to ona jest jednostką rachunku; numer stolika przepisuje się przy okazji na zamówieniach, bo dla kuchni jest adresem, pod który idzie talerz, a nie faktem historycznym. Stary stolik zwalnia się natychmiast, razem ze zdjęciem ewentualnej blokady. Odmawiamy, gdy przy docelowym stoliku trwa inna wizyta — łączenie rachunków to osobna decyzja. Ślad zostaje w `OrderEvent` (`table_moved`) i w dzienniku (`table.moved`).
- Sekcja "Do wydania" — zamówienia gotowe w kuchni, z numerem stolika; akcja `Wydane`.
- **Przywołania gości** — powiadomienie z podanym powodem (pomoc / rachunek / woda) z akcją `Przyjęte` i `Obsłużone`. Przywołanie z powodem „rachunek" podbija stolik na górę listy.
- Podgląd szczegółów wizyty z listą uczestników i przypisaniem pozycji (§3.7a).
- Składanie i edycja zamówień w imieniu gościa (§3.7a).
- Filtr "moje stoliki" (przypisanie kelnera do stref).

### 3.7a Zamówienia składane i edytowane przez obsługę

Kelner musi móc zrobić wszystko to, co gość, i więcej. Model atrybucji i uprawnień czasowych: [architecture.md §13](architecture.md#13-atrybucja-i-edycja-zamówień).

#### Składanie zamówienia w imieniu gościa

- Wejście: kafel stolika → `Nowe zamówienie`, lub bezpośrednio z ekranu wizyty.
- **Wybór uczestnika** — dla kogo jest to zamówienie. Lista uczestników wizyty z nickami i awatarami; przycisk `Dodaj osobę bez telefonu` tworzy uczestnika po stronie obsługi. Bez tego kroku podział rachunku dla gości niekorzystających z aplikacji jest niemożliwy.
- Interfejs menu zoptymalizowany pod szybkie wprowadzanie: wyszukiwarka, ostatnio zamawiane, ulubione kuchni, klawiatura numeryczna do ilości. Kelner przyjmuje zamówienie **stojąc przy stoliku**, często pod presją czasu — liczba dotknięć na pozycję jest kluczową metryką tego ekranu.
- Modyfikatory i uwagi tak samo jak u gościa.
- Zamówienie kelnerskie **pomija ekran „Powiadomienia"** — kelner stoi przy stoliku i już je potwierdził.
- Widoczne oznaczenie na wszystkich widokach: pozycja dodana przez obsługę ma ikonę i nazwisko kelnera.

#### Edycja istniejącego zamówienia

- Akcje: dodanie pozycji, usunięcie, zmiana ilości, zmiana modyfikatorów, zmiana uwagi, **przepisanie pozycji na innego uczestnika** (częste przy podziale rachunku — „to danie było dla Marka, nie dla mnie").
- Zakres edycji zależy od statusu zamówienia i roli — pełna macierz w [architecture.md §13.3](architecture.md#133-kto-i-kiedy-może-edytować). Interfejs **wyszarza niedostępne akcje z wyjaśnieniem powodu**, zamiast je ukrywać: kelner musi rozumieć, dlaczego nie może usunąć dania, które kuchnia już smaży.
- Usunięcie pozycji będącej w przygotowaniu wymaga wyboru powodu (pomyłka gościa / pomyłka obsługi / brak składnika / reklamacja) i trafia do audit logu jako strata produktu.
- Edycja po `confirmed` wywołuje przeliczenie rachunku, powiadomienie kuchni i powiadomienie na telefonie gościa.
- Ustawienie lokalu: czy pozycje dodane po starcie przygotowania dopisują się do bieżącego zamówienia, czy tworzą zamówienie następcze (kuchnia mogła już wydrukować bon).

#### Historia zmian zamówienia

- Oś czasu w szczegółach zamówienia: każde zdarzenie z godziną, aktorem i zmianą (`było → jest`).
- **Wyraźne rozróżnienie wizualne: co dodał gość, a co obsługa** — inna ikona i kolor, filtr „pokaż tylko zmiany obsługi".
- Manager widzi nazwiska pracowników; kelner widzi skróconą historię bieżącej wizyty; kuchnia nie widzi historii wcale.
- Historia jest niemodyfikowalna i zachowywana po zamknięciu rachunku — stanowi materiał dowodowy przy sporze o rachunek i przy rozliczeniu kelnera.

### 3.7b Podział rachunku w panelu obsługi

Model i arytmetyka: [architecture.md §14](architecture.md#14-podział-rachunku).

- **Lista uczestników wizyty** z nickami, awatarami i sumą częściową każdej osoby. Kelner widzi to samo, co widzą goście w swoich telefonach — bez tego nie da się rozmawiać o rachunku przy stoliku.
- **Zmiana trybu podziału** (`none` / `per_person` / `per_item` / `equal` / `groups`) na prośbę gości. Zablokowana po pierwszej płatności w ramach wizyty.
- **Przypisywanie pozycji** — przeciągnięcie pozycji na uczestnika lub wybór z listy; dzielenie pozycji między kilka osób (np. butelka wina na trzy części).
- **Tworzenie grup rozliczeniowych** — zaznaczenie uczestników i połączenie ich w jedną grupę („dwie pary, dwa rachunki").
- **Ostrzeżenie o pozycjach nieprzypisanych** — rozliczenie w trybie `per_item` jest zablokowane, dopóki każda pozycja nie ma właściciela. Panel pokazuje listę „Do przypisania", zamiast po cichu doliczać je hostowi.
- **Widok postępu rozliczenia** — kto już zapłacił, kto nie, ile brakuje do pełnej kwoty. Kelner musi mieć tę odpowiedź natychmiast, gdy część stolika już wychodzi.
- Rozliczenie następuje **per grupa** — kelner przyjmuje płatność od jednej osoby lub grupy, reszta wizyty pozostaje otwarta.

#### Rozliczenie rachunku (tryb `pay_at_table`)

- Ekran rachunku wizyty: wszystkie zamówienia z wizyty w jednej liście, suma, VAT.
- Przy podzielonym rachunku ekran przełącza się na widok grup rozliczeniowych — każda grupa z własną kwotą, statusem i przyciskiem `Rozlicz`.
- Akcje: `Wydrukuj/pokaż rachunek` (dokument niefiskalny do przedstawienia gościowi), `Rozlicz`.
- Przy rozliczeniu kelner wybiera metodę: **gotówka / terminal kartowy / BLIK na terminalu / voucher**, opcjonalnie wpisuje napiwek i kwotę otrzymaną (kalkulator reszty).
- Rozliczenie zapisuje `collected_by_staff_id` — podstawa raportu rozliczenia kelnera na koniec zmiany.
- **Korekta rachunku** przed rozliczeniem: usunięcie pozycji, rabat kwotowy/procentowy, przeniesienie pozycji na inny stolik — każda akcja wymaga uprawnień managera lub trafia do audit logu.
- Po rozliczeniu **wszystkich** grup wizyta przechodzi w `closed`, stolik wraca do statusu wolnego, sesje gości wygasają. Przy rozliczeniu częściowym wizyta pozostaje otwarta z widoczną kwotą pozostałą do zapłaty.
- Zamknięcie wizyty z niedopłatą wymaga uprawnień managera i powodu — zapisywane jako strata w audit logu.
- Akcja `Wyślij zestawienie na e-mail` — rozbicie rachunku na uczestników, gdy płaci jedna osoba za wszystkich. Dokument informacyjny, nie paragon fiskalny.
- **Raport zmiany:** zestawienie na koniec dnia/zmiany — ile kelner przyjął gotówką, ile terminalem, suma napiwków, liczba obsłużonych wizyt.

#### Alerty rachunkowe

- Wizyta otwarta dłużej niż X godzin bez aktywności → oznaczenie `porzucona` i alert dla managera (potencjalne wyjście bez płacenia).
- Rachunek przekraczający `open_bill_limit_cents` → wyróżnienie stolika i wymuszenie potwierdzania kolejnych zamówień.

### 3.8 Historia zamówień i zwroty

- Lista wszystkich zamówień z filtrami: data, status, stolik, kelner, metoda płatności, kwota.
- Szczegóły zamówienia: pozycje, płatność, oś czasu statusów, powiązana ocena.
- **Anulowanie i zwrot** (tylko manager/owner): częściowy lub pełny, z obowiązkowym powodem, zwrot inicjowany u dostawcy płatności, zapis w audit logu.
- Eksport do CSV/XLSX dla księgowości.

### 3.9 Oceny i feedback

- Strumień ocen z filtrami: ocena (1–5), adresat (danie / kuchnia / obsługa / manager), przeczytane/nieprzeczytane, zakres dat.
- **Widok per danie:** średnia ocena, liczba ocen, trend w czasie — bezpośrednie wsparcie decyzji o zmianie karty.
- **Feedback prywatny do managera** — komentarze gości niewidoczne publicznie; oznaczanie jako przeczytane, przypisanie do osoby, notatka wewnętrzna.
- Alert przy ocenie ≤ 2 (natychmiastowe powiadomienie managera, szansa na reakcję zanim gość wyjdzie z lokalu).
- Podsumowanie tygodniowe wysyłane mailem do managera.

### 3.10 Raporty i analityka

- Sprzedaż w czasie (dzień/tydzień/miesiąc), z podziałem na kategorie i dania.
- Ranking dań: najlepiej sprzedające się, najbardziej dochodowe, najgorzej oceniane, martwe pozycje (nikt nie zamawia).
- Godziny szczytu (heatmapa dzień × godzina) — wsparcie grafiku pracy.
- Średni czas realizacji z podziałem na etapy (potwierdzenie → przygotowanie → wydanie), w tym **czas oczekiwania na potwierdzenie kelnera** — metryka jakości obsługi w trybie `pay_at_table`.
- Statystyki napiwków, metod płatności, języków wybieranych przez gości (cenne przy decyzji o kolejnych tłumaczeniach).
- **Raport rozliczeń kelnerów** — per osoba i per zmiana: przyjęta gotówka, płatności terminalem, napiwki, liczba obsłużonych wizyt, rachunki skorygowane/z rabatem.
- **Raport wizyt** — średnia wartość rachunku, średni czas trwania wizyty, rotacja stolików, liczba wizyt porzuconych bez rozliczenia.
- Eksport wszystkich raportów do CSV/PDF.

### 3.11 Personel

- Lista pracowników, role, status, ostatnie logowanie.
- Zapraszanie mailem lub generowanie kodu PIN do wspólnego tabletu.
- Dezaktywacja konta (nigdy twarde usunięcie — historia zamówień musi zachować powiązanie).
- Faza 2: statystyki wydajności kelnera (obsłużone stoliki, czas reakcji, oceny obsługi).

## 4. Wymagania specyficzne dla tabletów i telefonów

- ~~PWA instalowana na ekranie głównym (manifest, ikony, tryb standalone).~~
  **Skreślone 2026-08-26** razem z pracą bez sieci — panel otwiera się pod adresem
  w przeglądarce i nie ma nic do instalowania.
- Layout responsywny od 768px wzwyż; KDS zoptymalizowany pod 1024–1366px w poziomie.
- Gesty dotykowe, brak zależności od hovera, cele dotykowe ≥ 48px.
- Wake Lock — ekran nie gaśnie w trakcie zmiany.
- Powiadomienia dźwiękowe działające także przy zablokowanym ekranie (uwaga: ograniczenia iOS — dźwięk wymaga wcześniejszej interakcji użytkownika, panel powinien wymusić "kliknij, aby włączyć dźwięk" na starcie zmiany).
- Tryb kiosku (opcjonalnie): blokada wyjścia z aplikacji na urządzeniu współdzielonym.
- **Telefon** *(2026-09-01)*: nawigacja główna na dolnej krawędzi, w zasięgu kciuka — kelner obsługuje panel jedną ręką, w ruchu, a górna krawędź telefonu jest wtedy najtrudniejsza do trafienia. Nazwisko i wylogowanie w menu Ustawień. **Żaden ekran obsługi nie może wymagać przewijania w poziomie**; pilnuje tego test e2e, w tym na oknie 320 px.
- Odporność na pracę ciągłą 12h bez przeładowania strony (kontrola wycieków pamięci, automatyczne odświeżanie sesji).

## 5. Kryteria akceptacji

- [ ] Nowe zamówienie pojawia się w KDS w mniej niż 3 sekundy od momentu potwierdzenia (płatnością lub przez kelnera).
- [ ] Zamówienie oczekujące na potwierdzenie kelnera **nie jest widoczne w KDS**.
- [ ] Trzy zamówienia złożone w trakcie jednej wizyty tworzą jeden rachunek o poprawnej sumie.
- [ ] Dwa telefony skanujące ten sam kod QR dołączają do tej samej wizyty i wspólnego rachunku.
- [ ] Rozliczenie rachunku przez kelnera zamyka wizytę, zwalnia stolik i zapisuje `collected_by_staff_id`.
- [ ] Zmiana trybu zamawiania jest zablokowana, gdy w lokalu są otwarte nierozliczone wizyty.
- [ ] Raport rozliczenia zmiany zgadza się co do grosza z sumą rachunków rozliczonych przez danego kelnera.
- [ ] Kelner może złożyć zamówienie w imieniu wskazanego uczestnika oraz utworzyć uczestnika bez telefonu.
- [ ] Każda pozycja w panelu jednoznacznie pokazuje, czy dodał ją gość, czy obsługa — wraz z nazwiskiem kelnera.
- [ ] Historia zmian zamówienia zawiera każdą edycję z aktorem i wartościami `było → jest`, i nie da się jej zmodyfikować ani usunąć.
- [ ] Kelner nie może usunąć pozycji będącej w przygotowaniu bez podania powodu, a akcja trafia do audit logu.
- [ ] Suma kwot wszystkich grup rozliczeniowych równa się dokładnie kwocie rachunku wizyty (test na losowych podziałach z groszowymi resztami).
- [ ] Rozliczenie w trybie `per_item` jest zablokowane, dopóki istnieją pozycje nieprzypisane do uczestnika.
- [ ] Rozliczenie jednej grupy nie zamyka wizyty, dopóki pozostałe grupy nie zapłacą.
- [ ] Zmiana trybu podziału po pierwszej płatności w ramach wizyty jest zablokowana.
- [ ] Zmiana statusu w KDS jest widoczna w apce gościa w mniej niż 3 sekundy.
- [ ] Wyłączenie sieci na tablecie na 60s nie powoduje utraty żadnej akcji personelu po jej przywróceniu.
- [ ] Oznaczenie dania jako niedostępne usuwa je z menu gościa natychmiast, bez potrzeby odświeżania.
- [ ] Wygenerowany PDF z kodami QR drukuje się poprawnie na A4 i każdy kod prowadzi do właściwego stolika.
- [ ] Regeneracja kodu QR unieważnia poprzedni token.
- [ ] Konto z rolą `waiter` nie ma dostępu do cen zakupu, raportów ani ustawień abonamentu (weryfikacja po stronie API, nie tylko UI).
- [ ] Menu z brakującym tłumaczeniem wyświetla gościowi fallback w języku domyślnym, nigdy pusty tekst.
- [ ] Panel działa poprawnie na iPadzie (Safari) i tablecie Android (Chrome) przez pełną 12-godzinną zmianę.
