# kelbroo — pytania i decyzje dla prawnika

Stan na **28 sierpnia 2026**.

Ten dokument jest samodzielny: nie trzeba do niego czytać kodu ani pozostałych
plików. Zawiera **wyłącznie rzeczy wymagające decyzji prawnej** — wyciąg z naszego
wewnętrznego rejestru rozbieżności ([README.md](README.md) §7–§8), gdzie zostaje
strona techniczna.

Kolejność nie jest przypadkowa: część A to zapisy, które **już dziś nie opisują
stanu faktycznego**, część B to decyzje potrzebne przed dopisaniem czegokolwiek,
część D dotyczy funkcji jeszcze niezbudowanej — **płatności gości** — i jest pilna
inaczej niż reszta: potrzebujemy jej **przed rozpoczęciem prac**. Część C to fakty,
którymi możemy uzupełnić luki w dokumentach.

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
Obie zostały 27 sierpnia **domknięte zapisem** i czekają już tylko na weryfikację —
Polityka i Regulamin mają wersję z tego dnia.

---

## Część A. Zapisy rozjeżdżające się ze stanem faktycznym

### A1. PayU w Polityce §6 — zapis dopisany, prosimy o weryfikację

**Zmiana statusu 27 sierpnia 2026:** luka była opisana jako najpilniejsza z całej
listy i **została zamknięta zapisem w Polityce** (wersja z 27 sierpnia). Nie jest to
już brak w dokumencie, tylko zapis do sprawdzenia — dlatego zostaje w części A.

**Co teraz mówi dokument.** §6 wymienia PayU S.A. z siedzibą w Poznaniu jako odbiorcę
danych i podaje zakres: adres e-mail wskazany przez Klienta do rozliczeń, adres IP
osoby dokonującej zakupu, kwota, waluta, opis i numer zamówienia. Osobny punkt mówi,
że dane karty i kodu BLIK nie trafiają do naszych systemów. Poprawiliśmy też §9 ust. 3,
który wspominał o bramce płatności jako o funkcji przyszłej — teraz mówi wprost, że
dotyczy **płatności Gościa**, bo płatności abonamentowe Klienta już działają.

**Co dokładnie robi system** (sprawdzone w kodzie, nie z pamięci): adresu IP
**nie zapisujemy w bazie** — przekazujemy go wyłącznie w wywołaniu tworzącym płatność,
bo wymaga tego operator. Imienia i nazwiska nie przekazujemy: pola przewidziane na nie
w wywołaniu zostają puste. Zwrotnie otrzymujemy identyfikator zamówienia PayU i wynik
płatności.

**Czego potrzebujemy — dwie rzeczy, jedna z nich to decyzja:**
1. **Potwierdzenia roli PayU.** Napisaliśmy, że wobec danych transakcji PayU jest
   **odrębnym administratorem**, nie podmiotem przetwarzającym na nasze polecenie —
   z czego wynika, że **umowa powierzenia nie jest właściwym instrumentem** i dlatego
   jej nie zawieraliśmy. To nasze rozumienie, nie ustalenie prawne. Jeśli jest błędne,
   zmienia się nie tylko brzmienie §6, ale i to, jaki dokument musimy z PayU podpisać.
2. **Sprawdzenia danych rejestrowych PayU** przed publikacją — podaliśmy wyłącznie
   nazwę i miasto siedziby, świadomie nie wpisując adresu ani numeru KRS, żeby nie
   umieścić w dokumencie prawnym danych, których sami nie zweryfikowaliśmy. Jeśli
   pełna identyfikacja jest potrzebna, prosimy o właściwe brzmienie.

### A2. Okres rozliczeniowy w Regulaminie — zapis poprawiony, prosimy o weryfikację

**Zmiana statusu 27 sierpnia 2026:** i tę pozycję **domknęliśmy zapisem**
(Regulamin w wersji z 27 sierpnia), razem z A1 — jednym przeglądem obu dokumentów,
bo dwa osobne zawiadomienia klientów o zmianie kosztowałyby dwa razy więcej niż
jedno. Zostaje do sprawdzenia brzmienie, nie brak.

**Co mówił dokument.** §1 ust. 8 definiował okres rozliczeniowy jako **miesiąc
kalendarzowy**. Tabela w §5 ust. 2 podawała wyłącznie ceny miesięczne.

**Co mówi teraz.** §1 ust. 8 obejmuje okres **miesięczny albo roczny**, liczony
**od dnia zakupu**, z zastrzeżeniem, że przy braku odpowiadającego dnia okres kończy
się ostatniego dnia miesiąca, oraz z doliczaniem zakupu do końca trwającego okresu.
Tabela w §5 ust. 2 ma drugą kolumnę z cenami rocznymi; dodane ust. 2a i 2b podają
wysokość rabatu i mówią, że samoobsługowo kupuje się Starter i Pro.

**Dlaczego 2a i 2b, a nie przenumerowanie.** Ustępy 3–5 §5 zostały nietknięte
celowo — przenumerowanie sprawiłoby, że istniejące odwołania do „§5 ust. 3"
(brak zwrotu proporcjonalnego) zaczęłyby wskazywać co innego. Jeśli wolisz
przenumerować, powiedz — to zmiana redakcyjna, nie merytoryczna.

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

**Czego potrzebujemy:** potwierdzenia, że nowe brzmienie §1 ust. 8 oraz ust. 2a i 2b
w §5 są wystarczające i poprawne — w szczególności czy zastrzeżenie o przycięciu dnia
do długości krótszego miesiąca jest sformułowane dość jednoznacznie.

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
| Dane gościa | **żadne dane osobowe** — pseudonim i symbol losowane, bez konta i bez logowania. *Zmieni się to wraz z płatnościami gości: adres e-mail podawany jednorazowo do płatności, patrz D4* |
| Dane pracownika restauracji | imię i nazwisko, e-mail, rola, skrót hasła |
| Dane klienta (nabywcy) | nazwa firmy, NIP, adres, e-mail do faktur |
| Okres próbny | 14 dni planu Pro, **bez podawania karty** |
| Po wygaśnięciu | zamawianie wstrzymane, **dane nie są kasowane** |
| Izolacja danych między restauracjami | wymuszona w bazie danych, nie tylko w kodzie aplikacji |
| Hasła | przechowywane jako skrót bcrypt |
| Transmisja | wyłącznie HTTPS |
| Dostęp do zaplecza kelbroo | hasło **oraz kod jednorazowy wysyłany na e-mail** |
| Poczta wychodząca | Hostinger, nadawca `kontakt@kelbroo.com` |
| Operator płatności | **PayU S.A.**, od 26 sierpnia 2026; opisany w Polityce §6 od 27 sierpnia |
| Faktury VAT | wystawiane ręcznie poza systemem, w programie księgowym |

**Dwie rzeczy do potwierdzenia po naszej stronie**, zanim zostaną wpisane do
dokumentów — nie prosimy o decyzję, tylko sygnalizujemy, że jeszcze ich nie
potwierdziliśmy:

- fizyczna lokalizacja serwerów (polityka twierdzi, że **Frankfurt**, i opiera na
  tym mocne zdanie o braku transferu poza EOG),
- częstotliwość i retencja kopii zapasowych oraz lista osób z dostępem do bazy
  produkcyjnej.

---

## Część D. Płatności gości — pytania przed rozpoczęciem prac

Ta część dotyczy funkcji, której **jeszcze nie ma**: płatności gościa za zamówienie
w restauracji. Prosimy o nią **zanim zaczniemy budować**, a nie przed uruchomieniem —
odpowiedź „ta konstrukcja wymaga zezwolenia" po zbudowaniu funkcji znaczy wyrzucenie
całej pracy. Analiza techniczna: [analiza-platnosci-gosci.md](../analiza-platnosci-gosci.md).

### D1. Czy nasza konstrukcja wymaga zezwolenia — pytanie najważniejsze

**Jak to ma działać.** Restauracja zakłada **własne konto** u operatora płatności
(PayU i kolejni) i podaje nam do niego dane dostępowe. kelbroo **inicjuje płatność
na tym koncie** i nasłuchuje potwierdzenia. Pieniądze gościa idą od operatora
**wprost na konto restauracji** — nigdy przez nasze konto, nigdy przez nasz rachunek.

**Nasze rozumienie:** nie mamy w żadnym momencie władztwa nad cudzymi środkami,
więc nie świadczymy usługi płatniczej i nie potrzebujemy zezwolenia. Jesteśmy
dostawcą oprogramowania, tak jak wtyczka płatnicza do sklepu internetowego albo
system rezerwacyjny.

**Sprawdzian, który sobie postawiliśmy:** gdyby kelbroo zniknęło w środku dnia,
pieniądze zapłacone przez gości są u operatora i na koncie restauracji, a nie u nas.

**Czego potrzebujemy:** potwierdzenia, że to rozumienie jest prawidłowe — oraz
wskazania, co **zmieniłoby** tę ocenę. Interesuje nas zwłaszcza, czy zmienia coś
fakt, że przechowujemy dane dostępowe do konta klienta u operatora (patrz D2).

### D2. Przechowywanie danych dostępowych klienta

Żeby zainicjować płatność na koncie restauracji, musimy trzymać jej klucze API.
Będą szyfrowane i **świadomie wąskie**: nie będą obejmowały wywoływania zwrotów,
bo zwroty restauracja robi sama w panelu operatora.

**Pytanie:** czy przechowywanie i używanie cudzych danych dostępowych do konta
płatniczego rodzi po naszej stronie obowiązki, których nie mamy jako zwykły dostawca
oprogramowania — i czy potrzebujemy w umowie z klientem osobnego upoważnienia
do działania na tym koncie w jego imieniu.

### D3. Czy możemy negocjować zbiorczą stawkę prowizji

Kusi nas wynegocjowanie u operatora lepszej stawki dla wszystkich klientów kelbroo —
mały lokal sam wynegocjuje gorszą. **Na razie tego nie robimy**, właśnie z ostrożności.

**Pytanie:** czy taka rola — polecanie operatora i uzyskiwanie z tego korzyści dla
klientów albo dla siebie — zmienia naszą kwalifikację prawną. Czy różni się sytuacja,
w której z tego nic nie mamy, od tej, w której dostajemy wynagrodzenie od operatora.

### D4. Gość podaje adres e-mail — kolizja z Polityką §2

Operator wymaga adresu e-mail nabywcy. Zamierzamy pytać o niego **na naszym ekranie**,
przekazywać operatorowi i **nigdzie nie zapisywać** — tak samo jak przy zestawieniu
rachunku (Polityka §9 ust. 1).

**Problem:** Polityka §2 mówi dziś, że Gość **nie jest proszony** o podanie adresu
e-mail. To zdanie przestanie być prawdziwe.

**Czego potrzebujemy:** brzmienia, które obejmie sytuację „adres podawany jednorazowo,
wyłącznie w celu wykonania płatności, nieprzechowywany", oraz rozstrzygnięcia, kto jest
administratorem tych danych — my, restauracja czy operator. Alternatywa, którą
rozważaliśmy: adres zbiera bramka operatora, a my nie widzimy go wcale. Prosimy
o wskazanie, która droga jest czystsza.

### D5. Kto odpowiada wobec gościa

Sprzedawcą jest restauracja: wystawia paragon, przyjmuje reklamacje, robi zwroty.
Gość ma jednak w ręce **naszą** aplikację i zamierzamy dać mu w niej osobną ścieżkę
reklamacji do kelbroo, z kopią do restauracji.

**Pytanie:** czy przyjmowanie takich zgłoszeń czyni nas stroną sporu o jakość cudzego
jedzenia i jak sformułować ekran, żeby jasno mówił, że **przekazujemy, a nie
rozstrzygamy**. Dotyczy to także sytuacji, w której gość zapłacił, a lokal nie
zrealizował zamówienia.

### D6. Zwrot, którego nie widzimy

Zwroty robi restauracja w panelu operatora. W kelbroo zostaje **flaga** stawiana
przez obsługę: „ta pozycja została zwrócona".

**Pytanie:** czy taki zapis — nasza ewidencja oparta na oświadczeniu restauracji,
bez potwierdzenia z systemu płatniczego — jest wystarczający, jeśli kiedyś stanie się
dowodem w sporze. I czy powinniśmy w regulaminie wprost przypisać obowiązek zwrotu
restauracji.
