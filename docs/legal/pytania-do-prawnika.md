# kelbroo — pytania i decyzje dla prawnika

Stan na **26 sierpnia 2026**.

Ten dokument jest samodzielny: nie trzeba do niego czytać kodu ani pozostałych
plików. Zawiera **wyłącznie rzeczy wymagające decyzji prawnej** — wyciąg z naszego
wewnętrznego rejestru rozbieżności ([README.md](README.md) §7–§8), gdzie zostaje
strona techniczna.

Kolejność nie jest przypadkowa: część A to zapisy, które **już dziś nie opisują
stanu faktycznego**, część B to decyzje potrzebne przed dopisaniem czegokolwiek,
część C to fakty, którymi możemy uzupełnić luki w dokumentach.

---

## Kontekst w pięciu zdaniach

kelbroo to platforma SaaS dla restauracji. Gość skanuje kod QR przy stoliku,
przegląda menu i składa zamówienie z własnego telefonu; zamówienie trafia do panelu
kuchni i kelnera. **Gość nie zakłada konta i nie podaje danych osobowych** — jego
tożsamość na czas wizyty to wylosowany pseudonim i symbol graficzny.

Naszym klientem jest **restauracja (przedsiębiorca)**, która płaci nam stały
abonament miesięczny lub roczny. Wobec danych wprowadzanych przez restaurację
(pracownicy, zamówienia) jesteśmy **podmiotem przetwarzającym**; administratorem
jest restauracja. Wobec danych rozliczeniowych samej restauracji jesteśmy
administratorem.

Obowiązujące dokumenty: **Regulamin** i **Polityka prywatności** (w tym katalogu).

**Zmiana od poprzedniej wersji tych dokumentów:** od 26 sierpnia 2026 przyjmujemy
płatności za abonament online, przez PayU. To źródło dwóch pierwszych pozycji poniżej.

---

## Część A. Zapisy rozjeżdżające się ze stanem faktycznym

### A1. Polityka §6 nie wymienia PayU wśród odbiorców danych — najpilniejsze

**Co mówi dokument.** §6 („Odbiorcy danych i zasady transferu") wymienia jako
odbiorcę wyłącznie Hostinger (infrastruktura i poczta) i stwierdza, że dane nie
opuszczają EOG.

**Co robi system.** Przy każdym zakupie abonamentu przekazujemy do PayU **adres
e-mail nabywcy i jego adres IP**. Numerów kart nie widzimy ani nie przechowujemy —
dane karty gość wprowadza po stronie PayU.

**Uwaga na fałszywy trop.** §9 ust. 3 wspomina o bramce płatności, ale mówi
o **przyszłych płatnościach gości w restauracji** („po udostępnieniu rozliczeń
online"). Sytuacja, o którą tu chodzi, jest inna: to restaurator płacący nam za
abonament, i ona dzieje się już dziś. Nie jest opisana nigdzie.

**Czego potrzebujemy:**
1. Dopisania PayU do §6 wraz z zakresem przekazywanych danych.
2. Rozstrzygnięcia, **czy PayU jest w tej relacji odrębnym administratorem, czy
   podmiotem przetwarzającym** — od tego zależy, czy potrzebna jest umowa
   powierzenia, czy wystarczy poinformowanie w polityce.

### A2. Regulamin nie zna płatności rocznej ani sposobu liczenia okresu

**Co mówi dokument.** §1 ust. 8 definiuje okres rozliczeniowy jako **miesiąc
kalendarzowy**. Tabela w §5 ust. 2 podaje wyłącznie ceny miesięczne.

**Co robi system.** Sprzedajemy dwa okresy:

| Plan | Miesięcznie (netto) | Rocznie (netto) | Rabat roczny |
|---|---|---|---|
| Starter | 159 zł | 1 590 zł | −17% (dwa miesiące gratis) |
| Pro | 349 zł | 3 490 zł | −17% |

Okres liczymy **od dnia zakupu**, nie od pierwszego dnia miesiąca, z przycięciem
dnia do długości krótszego miesiąca: zakup 31 stycznia kończy się ostatniego dnia
lutego. Zakup w trakcie trwającego okresu **dolicza się do jego końca**, więc
płacący z wyprzedzeniem nie traci opłaconych dni.

Uważamy ten sposób za korzystniejszy dla klienta niż rozliczanie od pierwszego dnia
miesiąca, więc naszym zdaniem poprawka należy się dokumentowi, nie systemowi.

**Czego potrzebujemy:** poszerzenia definicji okresu rozliczeniowego o wariant
roczny i o liczenie od dnia zakupu, oraz dopisania cen rocznych do §5 ust. 2.

### A3. Regulamin §7 ust. 1 — „panel obsługi pozostaje w trybie do odczytu"

**Co mówi dokument.** Brak zapłaty skutkuje zawieszeniem modułu zamawiania dla
gości, a panel obsługi **pozostaje w trybie do odczytu**.

**Co robi system.** Wstrzymujemy przyjmowanie nowych zamówień — i u gościa,
i w panelu. Celowo **zostawiamy dostępne**: rozliczanie otwartych rachunków,
wydawanie z kuchni i zamykanie wizyt. Dosłowny „tryb do odczytu" uwięziłby gotówkę
w lokalu, któremu abonament skończył się w środku serwisu, i zrobiłby z naszego
problemu jego problem.

**Czego potrzebujemy:** złagodzenia zapisu. Proponowane brzmienie: *„…skutkuje
automatycznym zawieszeniem modułu zamawiania dla Gości oraz przyjmowania nowych
zamówień w panelu. Rozliczenie otwartych rachunków, realizacja zamówień już
przyjętych i wgląd w historię pozostają dostępne."*

### A4. Regulamin §7 ust. 3 i Polityka §5 — usuwanie danych po 6 miesiącach

**Co mówi dokument.** Dane nieopłaconego konta są **trwale usuwane po 6 miesiącach**
od wygaśnięcia abonamentu.

**Co robi system.** Nie usuwa nic. Funkcja nie istnieje i pierwszy termin zapadnie
sześć miesięcy po pierwszym wygasłym koncie.

**Czego potrzebujemy — pytania, nie tylko potwierdzenia:**
1. Czy usunięcie ma obejmować **całą organizację**, czy tylko dane osobowe,
   z zachowaniem danych statystycznych bez identyfikacji?
2. Czy przed usunięciem musimy klienta **zawiadomić**, a jeśli tak — z jakim
   wyprzedzeniem i na jaki adres?
3. Czy dane, których administratorem jest restauracja (zamówienia, pracownicy),
   podlegają temu samemu terminowi, skoro to ona, a nie my, decyduje o ich losie?

### A5. Regulamin §7 ust. 2 — wypowiedzenie „z poziomu panelu Konta"

**Co mówi dokument.** Klient może wypowiedzieć umowę z poziomu panelu albo mailowo.

**Co robi system.** W panelu nie ma takiej funkcji; zostaje droga mailowa.

**Czego potrzebujemy:** decyzji, czy dopisujemy przycisk w panelu, czy skreślamy
te słowa z regulaminu. To najłagodniejsza z pozycji — klient nie zostaje bez wyjścia.

---

## Część B. Decyzje potrzebne przed dopisaniem czegokolwiek

1. **Czy plan Menu (0 zł) wchodzi do oferty.** Bezpłatny plan oznacza umowę bez
   wynagrodzenia — wpływa na zakres regulaminu i na to, co możemy w nim wyłączyć.
   Dziś plan istnieje w cenniku, ale **nie da się go kupić** w panelu.
2. **Wypowiedzenie umowy** — w dowolnym momencie ze skutkiem na koniec okresu
   rozliczeniowego, czy z okresem wypowiedzenia?
3. **SLA i odpowiedzialność za przerwy w działaniu.** Naszym zdaniem **nie
   deklarujemy SLA na tym etapie**, ale regulamin powinien to mówić wprost, zamiast
   milczeć.
4. **Odpowiedzialność za treść karty menu** — alergeny, składy, ceny. Naszym zdaniem
   odpowiada restauracja i regulamin powinien to przesądzać.
5. **Czy potrzebny jest osobny regulamin dla gościa**, skoro gość nie zawiera z nami
   umowy, nie zakłada konta i nie podaje danych osobowych.
6. **Czy nasze wsparcie techniczne może wchodzić w konto klienta** (podgląd danych
   restauracji przy zgłoszeniu). Pytanie jest tak samo prawne, jak techniczne:
   jesteśmy podmiotem przetwarzającym, więc taki dostęp musi mieć podstawę w umowie
   powierzenia i zostawiać ślad w dzienniku. Funkcji jeszcze nie ma — pytamy, zanim
   powstanie.
7. **Umowa powierzenia przetwarzania** — czy obecny kształt (jeśli istnieje jako
   część regulaminu) wystarcza, czy potrzebny jest osobny dokument podpisywany przy
   rejestracji.

---

## Część C. Fakty, którymi możemy uzupełnić dokumenty

Podajemy je, żeby nie trzeba było o nie pytać.

| Zagadnienie | Stan faktyczny |
|---|---|
| Rola wobec danych restauracji | podmiot przetwarzający; administratorem jest restauracja |
| Rola wobec danych rozliczeniowych klienta | administrator |
| Dane gościa | **żadne dane osobowe** — pseudonim i symbol losowane, bez konta i bez logowania |
| Dane pracownika restauracji | imię i nazwisko, e-mail, rola, skrót hasła |
| Dane klienta (nabywcy) | nazwa firmy, NIP, adres, e-mail do faktur |
| Okres próbny | 14 dni planu Pro, **bez podawania karty** |
| Po wygaśnięciu | zamawianie wstrzymane, **dane nie są kasowane** |
| Izolacja danych między restauracjami | wymuszona w bazie danych, nie tylko w kodzie aplikacji |
| Hasła | przechowywane jako skrót bcrypt |
| Transmisja | wyłącznie HTTPS |
| Dostęp do zaplecza kelbroo | hasło **oraz kod jednorazowy wysyłany na e-mail** |
| Poczta wychodząca | Hostinger, nadawca `kontakt@kelbroo.com` |
| Operator płatności | **PayU**, od 26 sierpnia 2026 |
| Faktury VAT | wystawiane ręcznie poza systemem, w programie księgowym |

**Dwie rzeczy do potwierdzenia po naszej stronie**, zanim zostaną wpisane do
dokumentów — nie prosimy o decyzję, tylko sygnalizujemy, że jeszcze ich nie
potwierdziliśmy:

- fizyczna lokalizacja serwerów (polityka twierdzi, że **Frankfurt**, i opiera na
  tym mocne zdanie o braku transferu poza EOG),
- częstotliwość i retencja kopii zapasowych oraz lista osób z dostępem do bazy
  produkcyjnej.
