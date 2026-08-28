# Analiza: płatności gości i ich rozliczanie

_Analiza funkcjonalna, 28 sierpnia 2026. **Nic z tego nie jest zbudowane.**
Dokument opisuje, jak płatność gościa miałaby działać przy decyzjach już podjętych,
i co przy niej ryzykujemy._

Poprzedza go [analiza trybu przedpłaconego](analiza-tryb-przedplacony.md), która
rozstrzygnęła model obsługi. Ten dokument dotyczy wyłącznie pieniędzy.

---

## 1. Decyzje, na których to stoi

| Decyzja | Konsekwencja |
|---|---|
| **Pieniądze idą wprost do restauracji** — jej konto u operatora, jej klucze | Nie dotykamy cudzych środków, nie jesteśmy pośrednikiem |
| **Paragon wystawia kasa lokalu** | Fiskalizacja zostaje poza kelbroo (opcja A z [§12](architecture.md)) |
| **Jeden model naraz** — albo wszystko u kelnera, albo wszystko w aplikacji | Nie ma stolika z połową rachunku opłaconą |
| **Funkcja planu Pro i wyżej** | Z możliwością włączenia z zaplecza, wzorem zdjęć i ocen |
| **Bez on-premise** (2026-08-28) | Jedna instalacja, którą kontrolujemy |

## 2. Kto jest kim w tej transakcji

To jest najważniejszy akapit całego dokumentu, bo z niego wynika reszta.

- **Gość** kupuje posiłek **od restauracji**. Nie od nas.
- **Restauracja** jest sprzedawcą: wystawia paragon, odpowiada za reklamacje,
  przyjmuje zwroty, ma umowę z operatorem płatności.
- **Operator** (PayU i kolejni) przyjmuje pieniądze i wypłaca je restauracji.
  Ma zezwolenie, którego my nie mamy i nie potrzebujemy.
- **kelbroo** jest oprogramowaniem, które **inicjuje płatność na cudzym koncie**
  i słucha, czy się powiodła. W żadnym momencie nie ma władztwa nad środkami.

Praktyczny sprawdzian tej konstrukcji: gdyby kelbroo zniknęło w środku dnia,
pieniądze już zapłacone przez gości **są u operatora i na koncie restauracji**,
a nie u nas. Jeśli kiedykolwiek przestanie to być prawdą, konstrukcja się
posypała i trzeba wrócić do prawnika.

## 3. Ścieżka, która się udaje

```
Koszyk → „Zamawiam i płacę"
  → zamówienie powstaje: status `submitted`, płatność `awaiting_payment`
  → serwer prosi operatora (na koncie restauracji) o adres płatności
  → gość idzie na bramkę: BLIK / karta / Apple Pay / Google Pay
  → operator inkasuje pieniądze
  → POWIADOMIENIE od operatora → nasz serwer, podpis zweryfikowany
  → zamówienie: `confirmed`, płatność `paid`  ← DOPIERO TU widzi je kuchnia
  → gość widzi „Opłacone", numer do odbioru i status na żywo
```

**Bramką jest powiadomienie od operatora, nigdy powrót przeglądarki.** Powrót
gościa na `continueUrl` służy wyłącznie do zapytania serwera, co wie. To ta sama
zasada, która trzyma dziś bramkę abonamentową — i istnieje z konkretnego powodu:
adres powrotu da się otworzyć ręcznie, więc zamówienie oparte na nim można sobie
„opłacić" jednym kliknięciem.

**Kuchnia nigdy nie widzi zamówienia nieopłaconego.** Bramka jest ta sama, którą
dziś przechodzi potwierdzenie kelnera — zmienia się tylko to, co ją otwiera.

## 4. Ścieżki, które się nie udają

Tych jest więcej niż tej jednej wyżej i to one decydują o jakości funkcji.

| Sytuacja | Co robimy |
|---|---|
| **Powiadomienie nie dotarło** (awaria sieci, zły adres, nasze API leżało) | Zadanie uzgadniające pyta operatora o zamówienia wiszące dłużej niż kilkanaście minut i **księguje je samo**. Wzorzec działa dziś przy abonamentach i to najważniejsza rzecz do przeniesienia |
| **Płatność w toku** | Zamówienie czeka, gość widzi „czekamy na potwierdzenie". Kuchnia nie gotuje. **Zwykły przelew jest wykluczony** (decyzja 2026-08-28), ale okno oczekiwania zostaje: BLIK czeka na potwierdzenie w aplikacji banku, karta na 3DS |
| **Gość zamknął przeglądarkę po zapłacie** | Płatność i tak dochodzi powiadomieniem; zamówienie idzie do kuchni. Gość odzyskuje ekran statusu tokenem wizyty |
| **Płatność odrzucona albo porzucona** | Zamówienie zamyka się jako `canceled` po czasie. Nic nie trafia do kuchni, nic nie zostaje na rachunku |
| **Podwójne powiadomienie** | Bramka atomowa w bazie: drugie przejście nie robi nic. Wzorzec działa dziś przy abonamentach |
| **Kuchnia nie może zrealizować opłaconego zamówienia** | **Zwrot.** Patrz niżej — to najtrudniejszy punkt całej funkcji |
| **Abonament restauracji wygasł w trakcie** | Wygaśnięcie wstrzymuje **nowe** zamówienia. Opłacone muszą się dokończyć — inaczej gość płaci za nasz spór z restauracją |

## 5. Zwroty — najtrudniejszy punkt

Dziś odrzucenie zamówienia nic nie kosztuje. Tutaj kuchnia odrzuca zamówienie
**już opłacone**, a **gość stoi w lokalu**. To zmienia wszystko.

**Zwrot przez operatora trwa dni, a gość czeka minuty.** To jest różnica między
handlem w internecie a lokalem gastronomicznym i nie da się jej rozwiązać kodem.
Restauracja musi mieć **politykę na miejscu**, a kelbroo ma ją wspierać, nie
udawać, że problemu nie ma:

1. **Zaproponuj coś innego** — najczęstsze i najlepsze wyjście. Zamówienie zostaje
   opłacone, zmienia się jego treść. Wymaga ścieżki „zamień pozycję" na opłaconym
   zamówieniu, z zapisem w historii.
2. **Zwróć gotówką od ręki** — restauracja oddaje z kasy, a w kelbroo zapisuje, że
   zwrot nastąpił poza operatorem. Prosto dla gościa, wymaga ewidencji.
3. **Zwrot przez operatora** — pieniądze wracają tą samą drogą, ale za dwa–pięć dni.
   Jedyne wyjście, gdy gościa już nie ma.

**Decyzja 2026-08-28: zwrotów nie wywołujemy — robi je restauracja w panelu
operatora.** To zmniejsza największe ryzyko tej funkcji, bo klucze, które trzymamy,
nie muszą mieć uprawnienia do rozporządzania pieniędzmi na koncie klienta.

Cena tej decyzji jest realna i trzeba ją znać: **kelbroo nie wie z własnego
działania, czy zwrot nastąpił.** Zostaje nam ewidencja — „ten rachunek wymaga
zwrotu" — i lista rzeczy do załatwienia, ale bez potwierdzenia z naszej strony.
Nie możemy też zaalarmować o nieudanym zwrocie, bo go nie widzimy.

Stąd pytanie otwarte: czy **nasłuchujemy powiadomień o zwrotach** od operatora
(bez uprawnienia do ich wywoływania), czy kelner odznacza je ręcznie.

## 6. Napiwki

Pola są (`tippingEnabled`, `tipPresets`, `tipCents`), ścieżki nie ma. Przy płatności
z góry napiwek jest **przed obsługą**, czyli za coś, czego jeszcze nie było —
to inna sytuacja niż napiwek po posiłku i lokal powinien móc go wyłączyć.

Napiwek wchodzi w kwotę pobraną przez operatora, więc **trafia na konto
restauracji razem z resztą** i jej zostawiamy rozliczenie z obsługą. Nie
prowadzimy rozliczeń kelnerów z napiwków; ewidencja tak, wypłaty nie.

## 7. Rozliczanie — trzy różne rzeczy pod jednym słowem

Warto je rozdzielić, bo mieszanie ich jest źródłem nieporozumień.

**7a. Gość ↔ restauracja.** Zamknięte w chwili zamówienia. Nie ma rachunku do
zamknięcia, nie ma „poproszę o rachunek", nie ma podziału. To cała zaleta tego
trybu.

**7b. Operator ↔ restauracja.** Wypłaty idą **poza kelbroo** — operator przelewa
restauracji jej pieniądze według własnego harmonogramu, potrącając swoją prowizję.
**Nie jesteśmy w tym przepływie i nie mamy do niego wglądu.**

Ale restauracja musi umieć go uzgodnić, więc dajemy jej **dzienny raport płatności**:
ile zamówień, na jaką kwotę, jakimi metodami, z identyfikatorami operatora. To jest
dokument, który manager kładzie obok wyciągu z PayU i obok raportu z kasy.
**Kwoty w kelbroo to kwoty pobrane od gości — nie to, co wpłynie na konto**, bo
prowizja operatora jest między nimi. Raport musi to mówić wprost, inaczej pierwsze
uzgodnienie skończy się telefonem do nas.

**7c. kelbroo ↔ restauracja.** Abonament, bez zmian. **Nadal nie pobieramy prowizji
od zamówień** i ta funkcja tego nie zmienia.

**Kto płaci prowizję operatora** (decyzja 2026-08-28): przy abonamencie — my, bo to
my sprzedajemy. Przy zamówieniu gościa — **restauracja**, bo to ona sprzedaje
i to na jej konto wpływają pieniądze. Klient policzy tę prowizję do kosztu kelbroo,
więc mamy o niej mówić wprost, zamiast pozwolić mu ją odkryć na pierwszym wyciągu.

## 8. Zgodność z kasą fiskalną — ryzyko operacyjne, nie techniczne

Sprzedaż jest opłacona online, ale paragon wystawia kasa lokalu. Ktoś musi tę
sprzedaż na kasie **nabić** — i tu są dwa błędy do popełnienia:

- **Sprzedaż niezafiskalizowana** — nikt nie nabił, bo „przecież zapłacone
  w aplikacji". Problem restauracji, ale to my dostarczyliśmy narzędzie, które go
  ułatwia.
- **Sprzedaż nabita dwa razy** — raz na kasie jako gotówka, raz jako opłacona.

Dlatego panel musi **jednoznacznie oznaczać zamówienia opłacone online** i mieć
dzienny raport do uzgodnienia z kasą. To nie jest funkcja wygody, tylko jedyna
rzecz, jaką możemy zrobić przeciwko obu błędom.

## 9. Konfiguracja po stronie restauracji

- **Własne konto u operatora** — restauracja przechodzi weryfikację **u niego**.
  Dni, nie minuty; onboarding tej jednej funkcji przestaje być samoobsługowy.
- **Klucze w panelu**, szyfrowane w bazie, **nigdy nieodsyłane po zapisaniu**
  (jak hasła). Do wymiany bez kontaktu z nami.
- **Tryb testowy przed uruchomieniem** — lokal wykonuje jedną prawdziwą płatność
  na grosze i widzi, że doszła. Bez tego pierwszym testem jest pierwszy gość.
- **Wyłącznik** — restauracja musi umieć wyłączyć płatności online w minutę, gdy
  coś nie działa, i wrócić do modelu z kelnerem.

## 10. Model danych — co dochodzi

| Obszar | Zmiana |
|---|---|
| Dane operatora per restauracja | Nowe, szyfrowane pola. Dziś klucze siedzą w zmiennych środowiskowych, bo konto jest jedno — nasze |
| `PaymentProvider` | Wartości `stripe`/`przelewy24`/`offline` nie obejmują PayU — enum do poprawienia |
| Abstrakcja dostawcy | `GuestPaymentProvider`, osobna od `SubscriptionPaymentProvider`: tam kasjerem jesteśmy my, tu restauracja |
| Weryfikacja powiadomień | Kluczem **konkretnej restauracji**: najpierw rozpoznanie, czyje zamówienie, potem podpis. Odwrotnie niż dziś |
| Zwroty | Nowa ścieżka i stan; dziś `refunded` istnieje w enumie i nie ma kodu |
| Raport płatności | Nowy widok w panelu, dzienny, do uzgodnienia z operatorem i kasą |
| Uzgadnianie wpłat | Zadanie cykliczne per restauracja, wzorem abonamentowego |

## 11. Ryzyka

Uporządkowane po tym, ile kosztuje ich zmaterializowanie się.

| Ryzyko | Dlaczego boli | Co z tym robimy |
|---|---|---|
| **Kompromitacja naszej bazy = dostęp do kont płatniczych klientów** | Trzymamy cudze klucze API. To **największe nowe ryzyko** tej funkcji i nie istniało wcześniej w żadnej postaci | Szyfrowanie, rotacja, dziennik użycia — oraz **wąskie uprawnienia klucza**: skoro zwroty idą poza nami (2026-08-28), klucz nie musi umieć rozporządzać pieniędzmi klienta |
| **Gość zapłacił i nie dostał jedzenia** | Obwini kelbroo, nawet gdy zawinił lokal albo operator. Reputacyjnie najgorszy scenariusz | Uzgadnianie wpłat, alarmy, widoczny status u gościa, ścieżka zwrotu z alarmem przy niepowodzeniu |
| **Sprzedaż niezafiskalizowana albo nabita dwa razy** | Problem podatkowy restauracji, którego narzędziem jesteśmy my | Wyraźne oznaczenie zamówień opłaconych online, dzienny raport do uzgodnienia z kasą |
| **Nasza konstrukcja jednak wymaga zezwolenia** | Cała funkcja do wyrzucenia | **Do potwierdzenia przez prawnika przed budową.** Nasza teza: nie mamy władztwa nad środkami, więc nie |
| **Zwrot, o którym nikt nie pamiętał** | Pieniądze gościa zostają w restauracji, a my nie mamy jak tego wykryć — zwroty idą poza nami (decyzja 2026-08-28) | Kolejka „zwroty do załatwienia" jako **ewidencja**, nie automat. Do rozstrzygnięcia: czy nasłuchujemy powiadomień o zwrotach |
| **Zależność od jednego operatora** | Lokal bez konta PayU nie kupi funkcji; awaria operatora zatrzymuje sprzedaż w lokalach, które nie mają kelnera | Abstrakcja dostawcy od pierwszej linii. Wyłącznik wracający lokal do modelu z kelnerem |
| **Reklamacje i chargebacki** | Idą do restauracji, nie do nas — to dobrze, ale ona musi o tym wiedzieć **przed** podpisaniem | Jasno w regulaminie i w materiałach sprzedażowych |
| **Onboarding przestaje być samoobsługowy** | Obietnica „uruchom w kwadrans" przestaje obowiązywać dla tej funkcji | Powiedzieć to wprost na stronie, zamiast pozwolić klientowi odkryć to po zakupie |
| ~~Przelew zwykły trwa dobę~~ | — | **Zamknięte 2026-08-28:** dopuszczamy wyłącznie metody natychmiastowe — BLIK, karta, Apple Pay, Google Pay. Do sprawdzenia u operatora, czy da się to **wymusić**, a nie tylko podpowiedzieć |

## 12. Rozstrzygnięcia z 28 sierpnia 2026

**Adres e-mail gościa.** Pole na **naszym ekranie**, przekazywane operatorowi
i **nigdzie niezapisywane** — ta sama zasada, co przy zestawieniu rachunku
(Polityka §9 ust. 1). Wymaga to zmiany w dokumentach: Polityka §2 mówi dziś, że
gość **nie jest proszony** o adres e-mail, a [docs/03 §3.3](03-customer-ordering.md)
powtarza „bez konta, bez e-maila". Oba zdania przestają być prawdziwe w tym trybie
i muszą zostać poprawione **zanim** funkcja ruszy.

**Zwroty.** Poza kelbroo. W panelu zostaje **flaga** — kelner, manager albo
właściciel oznacza pozycję jako zwróconą. To ewidencja, nie potwierdzenie: my nie
wiemy, czy pieniądze wróciły.

**Okno oczekiwania na płatność: 5 minut.** Kod BLIK żyje około dwóch minut, 3DS
trochę dłużej — pięć minut mieści jedną nieudaną próbę i ponowienie. Gość widzi
przez ten czas ekran „potwierdzamy płatność".

> **Warunek, którego nie wolno pominąć:** nasze okno **nie może być krótsze niż
> ważność zamówienia u operatora**. Inaczej zamkniemy zamówienie jako porzucone,
> a płatność dojdzie chwilę później — i powstanie pieniądz gościa bez zamówienia,
> którego sami nie zwrócimy, bo zwroty są poza nami. Albo zrównujemy oba okna,
> albo przy rezygnacji **zamykamy zamówienie także u operatora**.

**Dozamawianie: osobne transakcje.** Każde zamówienie to osobna płatność i osobna
prowizja operatora — trzy piwa dokładane pojedynczo to trzy opłaty. Restauracja
ma o tym wiedzieć przed uruchomieniem.

**Godziny otwarcia blokują zamawianie.** Poza godzinami gość nie złoży zamówienia,
więc nie ma płatności do zwracania. Pole `openingHours` istnieje w schemacie i nie
jest dziś egzekwowane — to praca do wykonania.

**Minimalna kwota zamówienia bez zmian.** Nie podnosimy jej w tym trybie.

**Napiwek po odbiorze, nie przy zamówieniu.** Osobna pozycja obok menu, dodawana
po posiłku — napiwek płacony z góry byłby napiwkiem za coś, czego jeszcze nie było.

> **Do policzenia przed budową:** napiwek jako osobna transakcja niesie **własną
> prowizję operatora**, w tym część stałą. Przy napiwku 2–5 zł potrafi ona zjeść
> znaczącą część kwoty i trafić do operatora zamiast do obsługi. Do rozważenia:
> czy napiwek nie powinien doklejać się do kolejnego zamówienia albo mieć progu.

**Zbiorczej stawki prowizji nie negocjujemy** — na razie. Każdy lokal umawia się
z operatorem sam.

**Reklamacja jakości: osobna ścieżka do kelbroo, z kopią do restauracji.**
Świadomie inaczej niż „wiadomość do managera" przy ocenach, która zostaje w lokalu.

> **Co to zmienia:** stajemy się adresatem skarg na cudze jedzenie. Nie robimy go,
> nie trzymamy pieniędzy i nie rozstrzygamy sporu — więc treść ekranu musi mówić
> wprost, że **przekazujemy, a nie rozstrzygamy**. Dochodzi też obowiązek: ktoś to
> musi czytać, a zgłoszenia bywają danymi osobowymi, wobec których jesteśmy
> administratorem.

## 13. Do rozstrzygnięcia przed budową

1. **Potwierdzenie prawne konstrukcji** — czy inicjowanie płatności na cudzym
   koncie, z przechowywaniem kluczy klienta, nie jest czynnością wymagającą
   zezwolenia.
2. **Czy `guest_choice` zostaje skreślony** — wynika to z zasady „jeden model
   naraz" ([analiza trybu §6](analiza-tryb-przedplacony.md)).
3. **Poprawka Polityki §2 i docs/03 §3.3** — oba mówią dziś, że gość nie podaje
   adresu e-mail. Przestaje to być prawdą.
4. **Zrównanie okna oczekiwania z ważnością zamówienia u operatora** (patrz §12).
5. **Koszt prowizji przy napiwku** — czy osobna transakcja na 3 zł ma sens.

Pozycje zamknięte 28 sierpnia: zwroty poza kelbroo, wyłącznie metody natychmiastowe,
prowizję gościa płaci restauracja, bez zbiorczej stawki, blokada poza godzinami
otwarcia, dozamawianie jako osobne transakcje, napiwek po odbiorze, osobna ścieżka
reklamacji.
