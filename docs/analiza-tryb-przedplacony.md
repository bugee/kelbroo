# Analiza: tryb przedpłacony i lokale bez kelnera

_Analiza funkcjonalna, 28 sierpnia 2026. **Nic z tego nie jest zbudowane.**
Cztery rzeczy zostały rozstrzygnięte (§1a, §1c, §5, §6), reszta czeka na decyzję._

Pieniądze, zwroty i rozliczanie opisuje osobno [analiza płatności gości](analiza-platnosci-gosci.md).

Punkt wyjścia: gość klika „Zamawiam", płaci od razu, a zamówienie idzie prosto do
kuchni. Kelner go nie potwierdza, nie ma prośby o rachunek, nie ma blokowania ani
przesadzania stolików. Paragon przynosi kelner razem z jedzeniem. Do tego ekran
w lokalu, na którym widać status zamówień.

To opis **innego modelu obsługi**, nie kolejnego przełącznika przy istniejącym.
Poniżej: co z tego wynika, co trzeba rozstrzygnąć i co zmienia się w architekturze.

---

## 1. Trzy pytania, które trzeba rozstrzygnąć przed resztą

### 1a. Czy to osobny plan abonamentowy? **Nie — i to jest rekomendacja.**

Oś planów sprzedaje dziś **pojemność i funkcje**: liczbę stolików, języków, kont
personelu, zdjęcia, oceny. Tryb obsługi to inna oś: nie „ile", tylko „jak lokal
pracuje". Wciśnięcie go w drabinkę planów oznaczałoby dwie równoległe drabinki
w cenniku i wybór przy rejestracji, którego klient jeszcze nie umie podjąć —
a bar, który latem otwiera ogródek z obsługą kelnerską, musiałby zmieniać plan
zamiast przełącznika.

**Rekomendacja:** jeden cennik, nowe pole **`Restaurant.serviceModel`** (roboczo:
`table_service` / `self_service`), a dostępność bramkowana funkcją planu — tak jak
zdjęcia dań i oceny. Zgodnie z wymaganiem: **Pro i wyżej**, z możliwością włączenia
z zaplecza w niższym planie.

### 1b. Czy to osobny typ klienta? **Częściowo tak — ale nie w bazie.**

Instynkt jest słuszny w jednym: food truck to inny klient niż restauracja
z obsługą. Różni się jednak **onboardingiem, słownictwem i kształtem panelu**,
a nie modelem danych. Nie potrzebuje własnej tożsamości ani osobnego systemu
(inaczej niż zaplecze kelbroo, które czyta w poprzek najemców).

Co z tego wynika praktycznie: kreator po rejestracji musi zapytać **„jak u Was się
zamawia?"** przed pytaniem o stoliki, a nie po. Dziś pierwszy krok onboardingu
zakłada stoliki i kody QR — dla okienka z kebabem to pytanie bez sensu.

### 1c. Czy lokal może nie mieć stolików? **Wirtualny stolik — z jednym warunkiem.**

**Decyzja: wirtualny stolik** („Lada", „Okienko"). Kod QR wskazuje na niego jak na
każdy inny, `table_id` zostaje `NOT NULL`, nie ma migracji ani przeglądu
pięćdziesięciu pięciu miejsc w API, które dziś zakładają stolik. To jest tańsze niż
robienie `table_id` opcjonalnym i tyle samo warte.

**Warunek jest jeden i nie wolno go pominąć: izolacja musi być strukturalna, nie
wizualna.** Dziś wejście przez kod QR **dołącza gościa do otwartej wizyty przy tym
stoliku**. Przy wirtualnej ladzie znaczyłoby to, że wszyscy klienci dnia trafiają
do jednej wizyty: wspólny rachunek, wspólna suma, wzajemny podgląd zamówień.

Zablokowanie tego widoku w aplikacji gościa **nie rozwiązuje problemu, tylko go
przykrywa** — i to w miejscu, w którym ten projekt już raz zajął stanowisko
(„ukrycie kontrolki jest wygodą, nie zabezpieczeniem", `reviews.service.ts`).
Dane nadal leżałyby w jednej wizycie, a bezpieczeństwo opierałoby się na tym, że
**każde** przyszłe miejsce czytające wizytę pamięta o filtrowaniu: ekran podziału,
zestawienie na e-mail, widok sali, panel kelnera, kolejny ekran napisany za pół
roku. Do tego psują się rzeczy niezwiązane z widocznością: `totalCents` wizyty staje
się sumą całego dnia przy ladzie, „jedna ocena na wizytę" znaczy jedną ocenę
dziennie, a wizyta nie ma momentu zamknięcia.

**Rozwiązanie: przy modelu samoobsługowym każdy skan zakłada własną wizytę**, zamiast
dołączać do otwartej. Wtedy izolacja wynika z modelu — inna wizyta to inny rachunek,
a wszystkie istniejące ścieżki (RLS, podgląd, oceny, zamykanie) działają bez
wyjątków. Wirtualny stolik zostaje tym, czym ma być: **miejscem, na które wskazuje
kod QR**, a nie jednostką rachunku.

Jedyny koszt: przy takim stoliku wisi naraz wiele otwartych wizyt. Ekran „Sala"
wyglądałby przy nim dziwnie — ale w tym trybie i tak jest zastąpiony ekranem
zamówień (§3.3).

---

## 2. Co znika w tym trybie

Nie „jest wyłączone", tylko **nie istnieje** — to różnica dla interfejsu i dla API.

| Funkcja | Dlaczego znika |
|---|---|
| Potwierdzanie zamówień przez kelnera | Bramką jest płatność, nie człowiek. `requireStaffConfirmation` traci sens |
| „Poproszę o rachunek" | Rachunek jest zapłacony w chwili złożenia |
| Podział rachunku (wszystkie tryby) | Nie ma czego dzielić — jedno zamówienie, jeden płatnik |
| Uczestnicy wizyty, nick, znak rozpoznawczy | Nie ma współdzielonego rachunku, do którego trzeba kogoś przypisać |
| Zgoda hosta na dołączenie | j.w. |
| Blokowanie i przesadzanie stolików, sprzątanie wizyty | Cykl życia stolika nie ma zastosowania |
| Wezwanie kelnera z powodem „rachunek" | Zostaje „pomoc" i „woda", jeśli lokal ma miejsca |
| Rozliczenie gotówką w panelu | **Wykluczone z założenia** — płatność wyłącznie online |
| Zestawienie „kto co zamówił" na e-mail | Zamówienie jest jednoosobowe; potwierdzenie płatności to co innego |

**Konsekwencja dla panelu:** to nie jest ukrywanie przycisków. Ekran „Sala" traci
sens w lokalu bez miejsc, a kolejka potwierdzeń jest zawsze pusta. Panel musi mieć
w tym trybie **inny zestaw ekranów**, nie ten sam z wyszarzonymi połowami.

---

## 3. Co dochodzi

### 3.1 Płatność jako bramka do kuchni

Zamówienie powstaje ze statusem płatności `awaiting_payment` (pole i ścieżka
**już istnieją** — `orders.service.ts` ustawia to dziś w trybie `prepaid`) i
przechodzi do `confirmed` **wyłącznie po potwierdzeniu webhookiem od operatora**,
nigdy po powrocie przeglądarki gościa. To ta sama zasada, która trzyma bramkę
abonamentową, i jest już przećwiczona na PayU.

### 3.2 Numer do odbioru

Krótki, czytelny z drugiego końca sali. `CounterScope.order` daje już dzienną
numerację zamówień per lokal — wystarczy ją pokazać.

### 3.3 Ekran statusu dla sali

Nowa powierzchnia, wymaga własnych decyzji:

- **Co pokazuje:** numery w dwóch kolumnach — „w przygotowaniu" i „do odbioru".
  Nic więcej: bez nazwisk, bez pozycji, bez kwot. Ekran wisi publicznie.
- **Jak się uwierzytelnia:** **nie kontem pracownika.** Tablet przyklejony do
  ściany nie może trzymać sesji, która daje dostęp do menu, personelu i rachunków.
  Potrzebny osobny **token ekranu** per lokal, do odwołania z panelu.
- **Czy jest w planie:** raczej tak samo bramkowany jak sam tryb.

### 3.4 Zwrot pieniędzy

Dziś odrzucenie zamówienia nic nie kosztuje. Tutaj kuchnia odrzuca zamówienie
**już opłacone** — skończył się składnik, lokal zamyka. To nowy obowiązek:
zwrot musi mieć drogę w systemie, a nie tylko w panelu operatora. Znamy ten
problem od strony abonamentów: zwrot zrobiony ręcznie u operatora **nie cofa**
niczego u nas.

### 3.5 Krótsze życie sesji gościa

Sesja żyje dziś 6 godzin, bo tyle trwa wizyta przy stoliku. Przy odbiorze spod
lady wizyta kończy się z wydaniem zamówienia.

---

## 4. Zmiany architektoniczne

| Obszar | Zmiana |
|---|---|
| `Restaurant` | Nowe `serviceModel`; `requireStaffConfirmation`, `tableActivationRequired`, `hostApprovesGuests`, `partialSettlementEnabled` przestają obowiązywać |
| `TableSession` | `tableId` opcjonalne; wizyta zakładana per zamówienie, nie per stolik |
| `app.resolve_qr_token` | Dziś rozwiązuje **stolik**. Potrzebna druga droga: token lokalu |
| `Order` / `OrderItem` | `tableId` opcjonalne (dziś `NOT NULL` w obu) |
| `Subscription` | Nowa flaga funkcji, wzorem `menuPhotosEnabled` i `reviewsEnabled` |
| Wizyta w trybie samoobsługowym | Każdy skan zakłada **własną** wizytę, zamiast dołączać do otwartej przy stoliku |
| Płatności gościa | **Nowa abstrakcja** — osobna od `SubscriptionPaymentProvider`, bo tam kasjerem jesteśmy my, a tu restauracja |
| Dane dostępowe operatora | Nowe, **szyfrowane** pola per restauracja. Dziś klucze PayU siedzą w zmiennych środowiskowych, bo konto jest jedno — nasze |
| Weryfikacja powiadomień | Podpis sprawdzany **kluczem konkretnej restauracji**: najpierw rozpoznanie, czyje to zamówienie, potem weryfikacja. Odwrotnie niż dziś |
| Zwroty | Nowa ścieżka: odrzucenie opłaconego zamówienia zwraca pieniądze |
| Ekran sali | Nowa powierzchnia + osobny mechanizm dostępu |
| Panel | Zestaw ekranów zależny od `serviceModel` |
| Onboarding | Pytanie o model obsługi **przed** stolikami |

---

## 5. Czego ta funkcja nie da się zrobić bez

**Decyzja: pieniądze idą wprost do restauracji.** Lokal konfiguruje **własne konto
u operatora** (PayU i kolejni), a kelbroo jedynie inicjuje płatność na tym koncie.
Pieniądze gościa nigdy przez nas nie przechodzą, więc **nie jesteśmy pośrednikiem
i nie potrzebujemy statusu instytucji płatniczej**.

Ta decyzja domyka dwie rzeczy naraz i warto zobaczyć obie:

- **Zgadza się z modelem biznesowym.** kelbroo nie pobiera prowizji od zamówień
  ([product.md §4](product.md)). Gdyby pieniądze szły przez nas, nieślibyśmy ryzyko
  rozliczeniowe i obsługę wypłat **za darmo** — model, w którym pośrednik nie zarabia
  na przepływie, nie ma sensu ani prawnego, ani ekonomicznego.
- **Domyka fiskalizację.** Skoro sprzedawcą jest restauracja, paragon wystawia jej
  kasa — dokładnie jak dziś w `pay_at_table`. To opcja A z [architektury §12](architecture.md),
  czyli **ani bridge'a, ani kasy wirtualnej**. Założenie „paragon przynosi kelner do
  stołu" przestaje być szczegółem obsługi, a staje się częścią konstrukcji prawnej.

**Czego ta decyzja nie daje za darmo:**

| | |
|---|---|
| **Onboarding przestaje być samoobsługowy** | Lokal musi mieć własne konto u operatora, czyli przejść weryfikację (KYC) **u niego**. To dni, nie minuty. Rejestracja w kelbroo pozostaje natychmiastowa, ale włączenie płatności online — nie |
| **Trzymamy cudze klucze** | Dane dostępowe do konta operatora to sekrety najwyższej wagi: szyfrowane w bazie, nigdy nieodsyłane do panelu po zapisaniu, do wymiany bez kontaktu z nami. Dziś klucze PayU siedzą w zmiennych środowiskowych, bo jest jedno konto — nasze |
| **Powiadomienia stają się per lokal** | Podpis powiadomienia weryfikuje się **kluczem tej restauracji**, a nie jednym globalnym. Trzeba najpierw rozpoznać, czyje to zamówienie, i dopiero potem sprawdzić podpis — kolejność odwrotna niż dziś |
| **Awaria jednego lokalu nie może dotknąć reszty** | Zły klucz albo zablokowane konto to problem tego lokalu, a nie całej platformy |
| **Zwroty idą przez konto lokalu** | Nasze uprawnienia muszą je obejmować — do sprawdzenia przy konfiguracji, nie po pierwszym odrzuconym zamówieniu |

**Potwierdzone prawnie 2026-08-28:** konstrukcja nie wymaga licencji KNF —
świadczymy usługę techniczną, bo środki idą wprost na konto klienta. Regulamin §7
zawiera upoważnienie do przechowywania jego kluczy API.

Dług, który wraca przy okazji: `FiscalizationProvider` miał być abstrakcją od
pierwszej linii kodu (CLAUDE.md), a w `apps/api/src` nie istnieje — jest wyłącznie
pole w schemacie. Przy opcji A zostaje `Noop`, ale abstrakcja ma stanąć wcześniej,
nie później.

---

## 6. Jeden model naraz

**Decyzja: lokal pracuje w jednym modelu — albo wszystko płatne u kelnera, albo
wszystko płatne w aplikacji.** Mieszanie tworzy dokładnie ten chaos, przed którym
ta funkcja ma chronić: przy jednym stoliku część zamówień opłacona, część nie,
kelner nie wie, czy nieść rachunek, a rozliczenie zmiany przestaje się zgadzać.

**To rozstrzyga otwarte pytanie o kawiarnię z okienkiem i stolikami** — nie da się
mieć obu modeli w jednym lokalu. Lokal, który naprawdę potrzebuje obu, zakłada dwie
restauracje w kelbroo.

**Konsekwencja, którą trzeba zobaczyć:** ta zasada uderza także w istniejący tryb
**`guest_choice`** („zapłać teraz albo u kelnera", wybór per zamówienie), zaplanowany
w etapie 2 i obecny w schemacie. Jest on z definicji modelem mieszanym — tyle że
mieszanym przez gościa, a nie przez lokal, więc chaos jest dokładnie ten sam.
**Do rozstrzygnięcia: czy `guest_choice` zostaje skreślony.**

## 7. Pytania otwarte

- Czy w tym trybie gość może **dozamawiać**, czy każde zamówienie to osobna
  transakcja? (Rekomendacja: osobna — inaczej wraca rachunek, który mieliśmy
  wyeliminować.)
- Czy **oceny dań** zostają? (Rekomendacja: tak, ale przypięte do zamówienia,
  nie do wizyty.)
- Czy potrzebne jest **zamawianie z wyprzedzeniem** (odbiór o 12:30)? Sąsiaduje
  z tym trybem, ale to osobna funkcja.
- Co widzi gość, który **zapłacił, a lokal odrzucił zamówienie** — i w jakim
  czasie wracają pieniądze?
- **Który operator poza PayU?** Lokal może już mieć umowę z innym. Abstrakcja
  dostawcy płatności gościa musi to przewidzieć od początku, tak jak przewidziała
  wymianę operatora abonamentowego.
