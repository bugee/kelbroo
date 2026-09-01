# System 3 — Aplikacja gościa: zamawianie, płatności i oceny

> Aplikacja: `apps/web-guest` — strona w przeglądarce, bez rejestracji i bez instalacji
> Odbiorca: gość restauracji · **bez rejestracji, bez instalacji aplikacji**
> Kontekst: [product.md](product.md) · [architecture.md](architecture.md)

## 1. Cel i zasada naczelna

Gość skanuje kod QR przy stoliku i w kilkanaście sekund ma przed sobą menu w swoim języku. Może zamówić, zapłacić, śledzić status i ocenić dania — bez zakładania konta, bez pobierania czegokolwiek ze sklepu z aplikacjami.

**Zasada naczelna:** każda przeszkoda między skanem a złożeniem zamówienia kosztuje konwersję. Brak rejestracji, brak zgód poza niezbędnymi, brak ekranów powitalnych. Menu ładuje się od razu po skanie.

## 2. Ścieżka gościa

Aplikacja ma **dwa warianty ścieżki**, zależne od trybu ustawionego przez restaurację ([product.md §5.6](product.md#56-tryby-zamawiania-i-płatności-wybór-restauracji)). Wariant jest znany po odczytaniu konfiguracji lokalu przy skanie QR — gość nigdy nie widzi opcji, których jego restauracja nie oferuje.

### Wariant A — `prepaid`: płatność w aplikacji

```
Skan QR → /r/{slug}/t/{qr-token}?lang=pl
  → anonimowa sesja gościa, dołączenie do wizyty przy stoliku
  → MENU (język wykryty automatycznie)
  → koszyk (podsumowanie, VAT, opcjonalny napiwek)
  → PŁATNOŚĆ (BLIK / karta / Apple Pay / Google Pay)
  → EKRAN STATUSU (live: przyjęte → w przygotowaniu → gotowe → wydane)
  → możliwość dozamówienia w trakcie wizyty (każde zamówienie płatne osobno)
  → po posiłku: OCENA DAŃ + FEEDBACK
```

### Wariant B — `pay_at_table`: płatność u kelnera po konsumpcji

```
Skan QR → /r/{slug}/t/{qr-token}?lang=pl
  → anonimowa sesja gościa, dołączenie do wizyty przy stoliku
     (jeśli lokal tego wymaga: "Poproś obsługę o otwarcie stolika")
  → MENU
  → koszyk (podsumowanie, VAT — BEZ płatności i BEZ napiwku)
  → "ZAMAWIAM"  →  zamówienie na rachunek stolika
  → EKRAN STATUSU (live: czeka na potwierdzenie → przyjęte →
                   w przygotowaniu → gotowe → wydane)
  → dozamawianie — wszystko dolicza się do TEGO SAMEGO rachunku
  → "POPROSZĘ RACHUNEK" → kelner przychodzi i rozlicza na kasie lokalu
  → po posiłku: OCENA DAŃ + FEEDBACK
```

**W wariancie B aplikacja nie zawiera żadnej ścieżki płatności.** Nie ma formularza karty, nie ma BLIK-a, nie ma napiwków online, nie ma pola e-mail do paragonu. Przycisk finalizujący brzmi „Zamawiam", nie „Zamawiam i płacę". Nie jest to płatność ukryta ani odroczona — to inny model produktu.

### Wariant C — `guest_choice`

Jak wariant A, ale na ekranie koszyka gość wybiera: `Zapłać teraz` albo `Zapłacę u kelnera`. Wybór dotyczy pojedynczego zamówienia; zamówienia nieopłacone trafiają na rachunek stolika.

## 3. Ekrany

### 3.1 Wejście po skanie QR

- Rozpoznanie restauracji i stolika z tokenu; walidacja: czy token aktywny, czy lokal otwarty, czy abonament aktywny, jaki tryb zamawiania obowiązuje.
- Dołączenie do otwartej wizyty przy stoliku (`TableSession`) lub jej utworzenie. Jeśli lokal wymaga otwarcia stolika przez obsługę, a wizyta nie jest otwarta — ekran „Poproś obsługę o otwarcie stolika" z przyciskiem przywołania kelnera; menu pozostaje przeglądalne.
- Automatyczny wybór języka: parametr `?lang=` → `Accept-Language` przeglądarki → język domyślny restauracji.
- Ekran ładowania z brandingiem restauracji (max 1s), po czym od razu menu.
- Stany błędu z konkretnym komunikatem: nieaktywny kod QR, lokal zamknięty (z godzinami otwarcia), zamawianie chwilowo niedostępne.
- Nagłówek potwierdza kontekst: nazwa restauracji + "Stolik 12" — gość musi mieć pewność, że zamawia na właściwy stolik.

### 3.2 Menu

- **Nawigacja po kategoriach** — przyklejony do góry pasek kategorii z płynnym przewijaniem.
- **Wyszukiwarka** dań (nazwa, składnik).
- **Filtry:** wegetariańskie, wegańskie, bezglutenowe, bez alergenu X, do X zł, najczęściej zamawiane.
- **Karta dania:** zdjęcie, nazwa, krótki opis, cena, tagi dietetyczne, średnia ocena (jeśli są oceny), czas przygotowania.
- Dania niedostępne wyszarzone z etykietą "Chwilowo niedostępne" — nieklikalne.
- **Przełącznik języka** zawsze dostępny w nagłówku (flagi/kody języków).
- Wyróżnienie dań polecanych i nowości.
- Sekcja "Popularne przy tym stoliku" / "Często zamawiane razem" (upsell, faza 2).

### 3.3 Szczegóły dania

- Duże zdjęcie, pełny opis, cena, kaloryczność, alergeny (rozwijana lista), tagi.
- **Modyfikatory:** grupy wyboru z walidacją (min/max), widoczna dopłata przy każdej opcji, cena aktualizowana na żywo.
- Pole "Uwagi do dania" (np. "bez cebuli") — z limitem znaków.
- Selektor ilości i przycisk `Dodaj do zamówienia — 42,00 zł` (cena zawsze na przycisku).
- Oceny innych gości (jeśli włączone przez restaurację).

### 3.3a Dołączenie do stolika — nick i awatar

Ekran pojawia się po skanie QR, **tylko gdy restauracja ma włączony podział rachunku** albo gdy przy stoliku jest już inny uczestnik. Przy samotnym gościu w lokalu bez podziału jest pomijany — nie wolno stawiać ekranu między skanem a menu bez powodu.

- **Nick** — pole tekstowe z przyciskiem `Wylosuj` obok. Losowanie jest ścieżką domyślną i wizualnie dominującą: jedno kliknięcie, zero wpisywania (np. „Wesoły Borsuk", „Szybki Jeż"). Gość może wpisać własny.
- **Awatar** — siatka ilustracji do wyboru, losowana wstępnie. Bez uploadu zdjęć: brak moderacji treści, brak przetwarzania wizerunku, brak ryzyka RODO.
- **Bez konta, bez e-maila, bez numeru telefonu.** Tożsamość żyje wyłącznie w ramach jednej wizyty.
- Nick jest widoczny dla pozostałych osób przy stoliku i dla obsługi — komunikat na ekranie mówi o tym wprost. Filtr wulgaryzmów i limit długości.
- Po dołączeniu gość widzi, kto jeszcze siedzi przy stoliku (awatary w nagłówku) — potwierdzenie, że trafił do właściwej wizyty.
- Pierwsza osoba przy stoliku zostaje gospodarzem (`is_host`) i jest domyślnym płatnikiem w scenariuszu „jedna osoba płaci za wszystkich".

### 3.3b Kto zamawia dla kogo

- Domyślnie każda pozycja dodana przez gościa jest **dla niego** (`for_participant_id` = jego uczestnik).
- Gość może dodać pozycję **dla kogoś innego przy stoliku** — wybór uczestnika w karcie dania (przydatne, gdy jedna osoba zamawia za całe towarzystwo).
- Pozycję można oznaczyć jako **dzieloną** i wskazać, między kogo (np. butelka wina na trzy osoby).
- Gość edytuje wyłącznie **własne** pozycje — nie może zmienić tego, co zamówił ktoś inny.
- Pozycja dodana lub zmieniona przez kelnera jest oznaczona w aplikacji gościa („Dodane przez obsługę"), bez nazwiska pracownika. Gość musi widzieć, że coś na jego rachunku pojawiło się nie z jego ręki — inaczej rachunek przestaje być weryfikowalny.

### 3.4 Koszyk

- Lista pozycji z modyfikatorami, uwagami, możliwością edycji ilości i usunięcia.
- **Pasek „dokończ zamówienie" widoczny z każdego ekranu**, dopóki coś leży w koszyku *(2026-09-01)*. Powstał z obserwacji w lokalu: gość dokładał dania i wychodził przekonany, że zamówił, bo przycisk kończący był widoczny wyłącznie na ekranie koszyka, a jedynym śladem niewysłanych pozycji był drobny napis w zakładce.
- **Zakładki nazwane językiem restauracji:** `Do zamówienia` i `Rachunek`, zamiast `Koszyk` i `Zamówienia`. Stare nazwy konkurowały ze sobą znaczeniowo — gość z pełnym koszykiem myślał o nim jako o swoim zamówieniu i szukał go w zakładce „Zamówienia", gdzie dostawał „nie masz żadnych zamówień".
- **Ekran rachunku z niepustym koszykiem** mówi wprost „nic jeszcze nie zamówiłeś" i prowadzi do koszyka, zamiast kończyć się ślepym zaułkiem.
- **Wezwanie kelnera stoi w nagłówku, nie w dolnym pasku** *(2026-09-01)*. W pasku była to **akcja w rzędzie nawigacji** — konkurowała o piksele z trzema zakładkami, a jej etykieta rosła wraz ze stanem („Kelner" → „Kelner — wysłane" → „Spróbuj jeszcze raz") i wypychała zakładkę „Rachunek" poza ekran telefonu. Nazwa przycisku jest teraz **stała**, stan niesie kolor i znacznik, a wyjaśnienie — osobna linijka nad zakładkami. Ceną jest gorszy zasięg kciuka; wezwanie kelnera jest akcją okazjonalną.
- **Z ekranu koszyka da się wrócić do menu** („Dodaj coś jeszcze"). Przy niepustym koszyku dolny pasek pokazuje wyłącznie „Zamawiam", więc bez tego gość, który zajrzał sprawdzić zamówienie i chciał dołożyć deser, musiał albo zamówić, albo usunąć wszystko.
- **Żaden ekran gościa nie może przewijać się w poziomie** — pilnuje tego test e2e na oknie 320 px, przechodzący przez stany wezwania kelnera i pełnego koszyka.
- Podsumowanie: suma, VAT (wyszczególniony).
- Pole "Uwagi do całego zamówienia".
- Ostrzeżenie o minimalnej wartości zamówienia, jeśli ustawiona.

**W trybie `prepaid`:**
- **Napiwek:** szybkie przyciski (5% / 10% / 15% / własna kwota / brak) — konfigurowalne i wyłączalne przez restaurację.
- Przycisk `Zamawiam i płacę` z ostateczną kwotą.

**W trybie `pay_at_table`:**
- Brak sekcji napiwku i płatności.
- Jeśli na rachunku stolika są już wcześniejsze zamówienia — informacja „Na Twoim rachunku: 128,00 zł" (widoczność bieżącego rachunku jest ustawieniem restauracji, patrz §3.9).
- Przycisk `Zamawiam`, a pod nim jednoznaczna informacja: **„Zapłacisz kelnerowi po posiłku."** Gość musi to wiedzieć przed wysłaniem zamówienia, nie po.

**W trybie `guest_choice`:** wybór `Zapłać teraz` / `Zapłacę u kelnera` przed przyciskiem finalizującym; napiwek pojawia się tylko przy pierwszej opcji.

### 3.5 Płatność (tylko tryby `prepaid` i `guest_choice`)

- Metody: **BLIK** (kod 6-cyfrowy), **karta** (Stripe Elements), **Apple Pay / Google Pay** (jeśli dostępne na urządzeniu — najszybsza ścieżka, promować na górze).
- Opcjonalne pole e-mail na potwierdzenie/paragon — **nieobowiązkowe**, bez tworzenia konta.
- Ekran przetwarzania z jasnym komunikatem, obsługa 3D Secure.
- Obsługa nieudanej płatności: koszyk zachowany, możliwość ponowienia inną metodą.
- **Zamówienie trafia do kuchni dopiero po potwierdzeniu płatności webhookiem od dostawcy.**

### 3.6 Status zamówienia (live)

- Wizualna oś postępu, zależna od trybu:
  - `prepaid`: `Opłacone` → `Przyjęte przez kuchnię` → `W przygotowaniu` → `Gotowe` → `Wydane`
  - `pay_at_table` z potwierdzaniem: `Wysłane` → **`Kelner potwierdza`** → `Przyjęte przez kuchnię` → `W przygotowaniu` → `Gotowe` → `Wydane`
- Etap „Kelner potwierdza" musi być opisany, a nie tylko zaznaczony — np. „Kelner zaraz podejdzie potwierdzić zamówienie". Gość bez wyjaśnienia odbiera zatrzymany pasek postępu jako awarię.
- Szacowany czas oczekiwania (na podstawie `prep_time` dań i obłożenia kuchni).
- Aktualizacja w czasie rzeczywistym (WebSocket, fallback na polling).
- Lista pozycji z indywidualnym statusem.
- Odrzucenie zamówienia przez kelnera: czytelny komunikat z powodem i możliwością poprawienia zamówienia (koszyk zachowany).
- Przyciski akcji: `Dozamów`, `Przywołaj kelnera`, `Poproś o rachunek` (w trybie `pay_at_table` jest to główna akcja kończąca wizytę).
- Ekran działa po odświeżeniu i powrocie do przeglądarki — stan przechowywany w sesji gościa.
- Powiadomienie w przeglądarce (jeśli gość wyrazi zgodę), gdy zamówienie jest gotowe.

### 3.6a Rachunek stolika (tryb `pay_at_table`)

- Widok zbiorczy wszystkich zamówień złożonych w trakcie wizyty, z sumą i wyszczególnionym VAT-em.
- Akcja `Poproszę o rachunek` → wysyła przywołanie do kelnera z powodem `bill`; ekran potwierdza „Kelner został powiadomiony".
- Po rozliczeniu przez kelnera: ekran podsumowania wizyty i przejście do oceny dań.
- **Ustawienie restauracji — widoczność rachunku:** przy jednym stoliku może siedzieć kilka osób skanujących ten sam kod. Do wyboru: pełny rachunek stolika (wszyscy widzą wszystko), tylko własne zamówienia z tego urządzenia, albo rachunek ukryty do momentu poproszenia o niego. Decyzja produktowa otwarta — patrz [product.md §9](product.md#9-otwarte-pytania--decyzje-do-podjęcia).
- Gość **nie może** samodzielnie oznaczyć rachunku jako zapłaconego — zamknięcie wizyty jest wyłącznie po stronie personelu.

### 3.6b Podział rachunku

Model i arytmetyka: [architecture.md §14](architecture.md#14-podział-rachunku). Poniżej wyłącznie warstwa gościa.

**W trybie `prepaid` podział jest domyślny i niewidoczny.** Każdy uczestnik zamawia i płaci ze swojego telefonu za własne pozycje — nie ma niczego do dzielenia po fakcie i nie pokazujemy żadnego ekranu podziału. To najprostszy możliwy split i największa zaleta tego trybu.

**W trybie `pay_at_table`** ekran podziału pojawia się przy akcji `Poproszę o rachunek`:

- **Jak dzielimy?** — cztery kafle z podglądem kwoty:
  - `Każdy za siebie` — pozycje już przypisane do uczestników (domyślne).
  - `Po równo` — suma dzielona przez liczbę osób.
  - `Po pozycjach` — ręczne przypisanie, z możliwością podzielenia jednej pozycji między kilka osób. **Od 2026-08-27 przypisuje kelner z panelu**, nie gość: rozmowa „kto brał wino?” toczy się przy stoliku, a układanie dwudziestu pozycji palcem na telefonie, przez kilka osób naraz i na wspólnym stanie, byłoby najgorszym możliwym pierwszym wariantem. Ekran gościa da się dołożyć później bez zmiany modelu.
  - `Grupami` — łączenie uczestników w grupy płatnicze („dwie pary, dwa rachunki").
  - `Jedna osoba płaci za wszystkich` — patrz niżej.
- Wybór podziału jest **wspólny dla stolika** — zmiana przez jedną osobę jest natychmiast widoczna na wszystkich telefonach. Wymaga to jasnej informacji, kto zmienił tryb, żeby uniknąć przeciągania liny między gośćmi.
- Po wyborze każdy uczestnik widzi na swoim telefonie **swoją kwotę** — dużą, jednoznaczną, gotową do pokazania kelnerowi.
- **Pozycje nieprzypisane** blokują przejście dalej, z listą „Do przypisania". Aplikacja nie może po cichu doliczyć ich gospodarzowi.
- Podział jest zablokowany po pierwszej płatności w ramach wizyty — komunikat wyjaśnia dlaczego.
- Rozliczenie następuje u kelnera; aplikacja pokazuje, kto już zapłacił, a kto jeszcze nie.

### 3.6c Jedna osoba płaci — zestawienie na e-mail

Scenariusz kolacji służbowej i spotkania rodzinnego: płaci jedna osoba, ale potrzebne jest rozliczenie, kto co zamówił.

- Gospodarz wybiera `Płacę za wszystkich` — wszyscy uczestnicy trafiają do jednej grupy rozliczeniowej.
- Po rozliczeniu (w aplikacji lub u kelnera) pojawia się akcja **`Wyślij zestawienie na e-mail`**.
- Zestawienie zawiera: pozycje pogrupowane po uczestnikach (awatar, nick, dania, suma częściowa), sumę całkowitą, datę, nazwę lokalu i numer stolika.
- **Każdy uczestnik może wysłać sobie własne zestawienie** na swój adres, niezależnie od gospodarza — to jego rozliczenie, nie tylko płatnika.
- E-mail podawany **doraźnie, wyłącznie do tej wysyłki**: bez zakładania konta, bez zapisu na stałe, bez zgód marketingowych. Pole opisane wprost: „Użyjemy tego adresu tylko do wysłania zestawienia."
- Dokument musi mieć widoczną adnotację: **to zestawienie informacyjne, nie paragon fiskalny.**

### 3.7 Przywołanie kelnera

- Prosty ekran z powodami: potrzebuję pomocy / poproszę rachunek / poproszę wodę / inne (pole tekstowe).
- Potwierdzenie wysłania + informacja, że kelner został powiadomiony.
- Ochrona przed spamem: limit jednego przywołania na 2 minuty na sesję.

### 3.8 Ocena dań i feedback

> **Stan na 2026-08-27:** zbudowane — ocena dań i wizyty, adresat (kuchnia/obsługa),
> wiadomość do managera, jedno zgłoszenie na gościa, panel z nieprzeczytanymi na górze.
> Pytanie pojawia się **na ekranie rachunku**, gdy gość ma wydane danie, a nie
> automatycznie po 15 minutach — timer wymagałby powiadomień push, których nie mamy.
> **Nie zbudowane:** odnośnik do Google przy ocenie 4–5, średnia ocena na karcie dania,
> pokazywanie ocen innych gości.

Wywoływana automatycznie po statusie `wydane` (z opóźnieniem ~15 min, by gość zdążył zjeść) oraz dostępna z menu w dowolnym momencie.

- **Ocena poszczególnych dań:** skala 1–5 gwiazdek dla każdej zamówionej pozycji, opcjonalny komentarz.
- **Ocena ogólna wizyty:** jedna gwiazdkowa ocena + wybór adresata feedbacku:
  - **Do kuchni** — o jakości i smaku dań,
  - **Do obsługi/managera** — o serwisie, czystości, atmosferze.
- Pole komentarza prywatnego "Wiadomość do managera" — **niewidoczna publicznie**, trafia bezpośrednio do panelu managera. To kluczowy mechanizm: niezadowolony gość mówi restauracji, zamiast wystawiać publiczną recenzję.
- Przy ocenie wysokiej (4–5): zachęta do wystawienia opinii w Google (link) — świadomy mechanizm reputacyjny.
- Przy ocenie niskiej (1–2): nie kieruj do publicznych recenzji; podziękuj i poinformuj, że manager został powiadomiony.
- Ocena możliwa bez konta, jedno zgłoszenie na zamówienie.

## 4. Sesja gościa i prywatność

- **Brak rejestracji.** Sesja anonimowa: podpisany token w `localStorage` powiązany ze stolikiem i restauracją.
- Sesja urządzenia (`GuestSession`) dołącza do wizyty przy stoliku (`TableSession`) — kilka telefonów przy jednym stoliku ma osobne sesje i wspólny rachunek.
- **Nick i awatar to tożsamość na czas wizyty, nie konto.** Generator nicków nie proponuje imion ani nazwisk, więc nick nie jest daną osobową; awatary pochodzą z zamkniętego zestawu ilustracji, bez uploadu zdjęć. Uczestnik znika wraz z zamknięciem rachunku.
- **E-mail do zestawienia rachunku** przyjmowany doraźnie, użyty jednorazowo do wysyłki i niezapisywany do celów marketingowych. Nie tworzy konta ani profilu.
- Czas życia sesji: do zamknięcia rachunku przez obsługę lub X godzin bezczynności (konfigurowalne, domyślnie 4h).
- Dane osobowe zbierane wyłącznie opcjonalnie (e-mail do paragonu) — zgodnie z zasadą minimalizacji RODO.
- Widoczna polityka prywatności i informacja, jakie dane są przetwarzane.
- Brak cookies śledzących bez zgody; analityka wyłącznie anonimowa/agregowana.
- Historia zamówień gościa dostępna tylko w ramach bieżącej sesji na tym urządzeniu.

## 5. Wymagania techniczne

- **Wydajność:** LCP < 2.0s na 4G. Menu prerenderowane/cache'owane na CDN, zdjęcia w AVIF/WebP z lazy loadingiem, aktualizacje przez inwalidację cache przy zmianie menu.
- **Rozmiar bundla:** możliwie mały — gość ładuje aplikację na często słabym wi-fi restauracyjnym.
- **Wymaga połączenia.** Praca bez sieci i instalacja na ekranie głównym zostały
  **skreślone 2026-08-26**. Brak internetu ma dawać czytelny komunikat, nie pusty ekran —
  i na tym koniec. Cachowanie karty kusi, ale menu zmienia się w trakcie serwisu, a karta
  pokazana z pamięci telefonu potrafi zawierać danie, którego już nie ma.
- **Dostępność:** WCAG 2.1 AA — kontrast, obsługa czytników ekranu, skalowanie tekstu, nawigacja klawiaturą. Aplikacji używa przypadkowa publiczność, w tym osoby starsze i z niepełnosprawnościami.
- **Kompatybilność:** iOS Safari 15+, Chrome Android 100+, tryby oszczędzania danych.
- **Wielojęzyczność:** UI z `next-intl`, treść menu z bazy; RTL przygotowane pod przyszłe języki (arabski).

## 6. Aplikacje natywne — skreślone

**Decyzja 2026-08-26: nie budujemy aplikacji natywnych.** Wcześniejsze wersje tego
dokumentu opisywały `apps/mobile-guest` w React Native jako Fazę 2, z historią zamówień
między wizytami, ulubionymi, powiadomieniami push i programem lojalnościowym.

Powód skreślenia jest ten sam, dla którego gość nigdy się nie rejestruje: cała wartość
tamtej listy wymagała konta użytkownika, a konto gościa jest dokładnie tym, czego
kelbroo nie chce mieć. Skan kodu QR otwierający stronę zostaje jedyną ścieżką.

## 7. Kryteria akceptacji

- [ ] Od skanu QR do wyświetlenia menu upływa mniej niż 2s na połączeniu 4G.
- [ ] Gość składa i opłaca zamówienie bez zakładania konta i bez instalowania czegokolwiek.
- [ ] Zmiana języka przełącza zarówno interfejs, jak i treść menu; brakujące tłumaczenie pokazuje fallback, nigdy pusty tekst.
- [ ] Status zamówienia aktualizuje się na żywo bez odświeżania strony.
- [ ] Odświeżenie strony lub zamknięcie i ponowne otwarcie przeglądarki nie gubi aktywnego zamówienia.
- [ ] Nieudana płatność zachowuje koszyk i pozwala ponowić próbę.
- [ ] W trybie `prepaid` zamówienie nie trafia do kuchni, dopóki płatność nie zostanie potwierdzona webhookiem.
- [ ] W trybie `pay_at_table` aplikacja nie eksponuje żadnej ścieżki płatności — audyt UI potwierdza brak formularza karty, BLIK-a i napiwków.
- [ ] Gość w trybie `pay_at_table` przed wysłaniem zamówienia widzi informację, że zapłaci u kelnera.
- [ ] Trzy zamówienia w trakcie jednej wizyty sumują się w jeden rachunek o poprawnej kwocie.
- [ ] Etap „Kelner potwierdza" jest opisany słownie, a nie tylko zaznaczony na pasku postępu.
- [ ] Odrzucenie zamówienia przez kelnera pokazuje gościowi powód i pozwala poprawić zamówienie.
- [ ] Ekran nicku/awatara nie pojawia się, gdy gość jest sam przy stoliku w lokalu bez podziału rachunku.
- [x] Wylosowanie nicku i znaku wymaga **zera kliknięć** — dzieje się przy wejściu (2026-08-26).
- [x] Gość może wpisać własny nick, **raz na wizytę** (2026-08-26). Znaku rozpoznawczego nie wybiera: musi zostać niepowtarzalny przy stoliku.
- [ ] Dwa telefony przy jednym stoliku widzą siebie nawzajem jako uczestników wizyty.
- [ ] W trybie `prepaid` każdy uczestnik płaci wyłącznie za własne pozycje, bez ekranu podziału.
- [ ] Zmiana trybu podziału przez jednego gościa jest natychmiast widoczna na pozostałych telefonach.
- [ ] Podział z groszową resztą sumuje się dokładnie do kwoty rachunku (weryfikacja na kwotach niepodzielnych przez liczbę osób).
- [x] Pozycje nieprzypisane do uczestnika blokują rozliczenie w trybie „po pozycjach". *(2026-08-27; przypisuje kelner z panelu — ekran gościa zostaje na później)*
- [ ] Pozycja dodana przez kelnera jest w aplikacji gościa oznaczona jako dodana przez obsługę.
- [ ] Gość nie może edytować pozycji zamówionej przez inną osobę przy stoliku.
- [x] Każdy uczestnik może wysłać sobie własne zestawienie na e-mail, niezależnie od tego, kto zapłacił. *(2026-08-27)*
- [x] Zestawienie e-mail zawiera adnotację, że nie jest paragonem fiskalnym. *(2026-08-27)*
- [ ] Ocena z niską notą (1–2) generuje natychmiastowe powiadomienie dla managera.
- [ ] Aplikacja przechodzi audyt dostępności WCAG 2.1 AA.
