# Analiza: zgoda i obowiązek informacyjny przy zestawieniu na e-mail

_Analiza, nie decyzja. 2 września 2026. **Nic z tego nie jest zbudowane.**
Dokument opisuje, co trzeba zrobić, żeby wysyłka zestawienia rachunku na adres
gościa była czysta pod RODO, w jakiej kolejności i czego to kosztuje._

**O gwarancji wprost:** gwarancji nie da tu ani kod, ani ten dokument — daje ją
podpis prawnika pod konkretnym brzmieniem. Ten tekst istnieje po to, żeby ten
podpis był tani i konkretny: nazywa luki, wypisuje warianty i kończy się listą
pytań gotową do wysłania. Wszystkie oceny prawne poniżej są **naszym odczytaniem
do potwierdzenia**, nie opinią.

---

## 1. Co działa dzisiaj

Gość na ekranie rachunku wpisuje adres i klika **Wyślij zestawienie**. Dostaje
listę „kto co zamówił" razem z sumą — do rozliczenia delegacji.

Stan faktyczny, sprawdzony w kodzie
([`bill-summary.service.ts`](../apps/api/src/guest/bill-summary.service.ts)):

- **Adres nie jest zapisywany nigdzie.** Nie ma kolumny w bazie, nie wchodzi do
  dziennika działań ani do logu — przechodzi przez pamięć procesu do serwera
  poczty i znika. Log zapisuje wyłącznie identyfikator wizyty.
- Limit **trzech wysyłek na sesję gościa**, w pamięci procesu.
- Pod formularzem stoją dwa zdania: „Użyjemy tego adresu tylko do wysłania
  zestawienia. Nie zakładamy konta i nigdzie go nie zapisujemy."
- W stopce wiadomości powtarza się to samo zdanie.

Czego nie ma: **żadnego odnośnika do polityki prywatności, żadnej informacji
o tym, kto jest administratorem, i żadnego checkboxa.**

## 2. Luka, którą trzeba załatać niezależnie od checkboxa

Komentarz w serwisie i [pytanie D4 do prawnika](legal/pytania-do-prawnika.md)
powołują się na **Politykę prywatności §9 ust. 1**.

**Ten paragraf nie istnieje.** Polityka kończy się na §8 i **nie wspomina
o zestawieniu na e-mail ani słowem.** Najbliższy zapis, §2, mówi o adresie
podawanym przy płatnościach online — czyli o czymś innym, czego zresztą jeszcze
nie ma.

To jest dzisiejszy stan: **działa funkcja zbierająca adres e-mail od osoby
fizycznej, której nie opisuje żaden dokument.** Niezależnie od tego, czy
skończy się na checkboxie, ten paragraf trzeba napisać — i to jest krok
pierwszy.

## 3. Kto jest administratorem — z tej odpowiedzi wynika cała reszta

Polityka §1 ust. 2 mówi: wobec danych wprowadzanych w trakcie pracy lokalu
(Pracownicy, Goście) administratorem jest **Klient**, czyli restauracja,
a kelbroo działa na jej polecenie jako podmiot przetwarzający.

Adres podany przy rachunku powstaje dokładnie tam — w aplikacji gościa, przy
stoliku restauracji. Z tego odczytania wynika, że:

> **administratorem jest restauracja, a klauzula informacyjna musi wskazywać
> restaurację, nie kelbroo.**

I tu zaczyna się problem techniczny, którego nie widać z ekranu: **nie mamy
w bazie tożsamości prawnej restauracji.** Jest `Restaurant.name` („Bistro
Widok"), opcjonalny `Restaurant.address` i `Organization.nip`. Nie ma pełnej
nazwy firmy, adresu siedziby ani adresu kontaktowego w sprawach danych.
Klauzula „administratorem jest Bistro Widok" nie spełnia art. 13 RODO.

Do rozważenia jest odczytanie alternatywne: przy **tej jednej operacji** to
kelbroo decyduje o celu i sposobie (my projektujemy wysyłkę, my ją wykonujemy),
więc występujemy jako **odrębny administrator**. Technicznie jest to znacznie
prostsze — klauzula wskazuje nas, dane firmowe mamy. Prawnie jest to wątpliwe
i **sprzeczne z dzisiejszym brzmieniem Polityki §1**.

**To jest pytanie numer jeden do prawnika.** Wszystko poniżej zależy od
odpowiedzi: kto stoi w klauzuli, kto odpowiada na żądania gościa i który
dokument dostaje nowy paragraf.

## 4. Czy checkbox jest właściwym narzędziem

Warto rozdzielić dwie rzeczy, które w rozmowie zlewają się w jedno:

| | Co to jest | Czy jest obowiązkowe |
|---|---|---|
| **Obowiązek informacyjny** (art. 13) | Powiedzieć, kto przetwarza, w jakim celu, jak długo i jakie są prawa | **Tak, zawsze**, w momencie zbierania danych |
| **Zgoda** (art. 6 ust. 1 lit. a) | Podstawa prawna przetwarzania — jedna z kilku możliwych | Tylko jeśli nie ma innej podstawy |

Nasze odczytanie, do potwierdzenia: **checkbox „akceptuję politykę prywatności"
nie załatwia ani jednego, ani drugiego.** Polityka jest informacją, a nie
oświadczeniem woli — jej „akceptacja" nie jest zgodą w rozumieniu RODO
i sprawia mylne wrażenie, że coś zabezpiecza.

Jest też pytanie, czy zgoda jest tu w ogóle potrzebną podstawą. Gość **sam
wpisuje adres i sam klika „Wyślij zestawienie"** — to jednoznaczne działanie
podjęte na jego własne żądanie. Prawnik może uznać, że wystarczy art. 6 ust. 1
lit. b albo f, a wtedy osobny checkbox dokłada kliknięcie i nie dokłada
ochrony.

Trzy warianty, które warto mu przedstawić:

| Wariant | Co gość widzi | Za | Przeciw |
|---|---|---|---|
| **W1. Sama klauzula** | Rozwijane „kto i po co przetwarza te dane" + odnośnik do dokumentu | Zero tarcia, spełnia art. 13 | Brak śladu, że gość to widział |
| **W2. Klauzula + checkbox zgody** | Nieodhaczony checkbox o **wysyłce**, nie o „akceptacji polityki" | Ślad zgody, czytelna intencja | Jedno kliknięcie więcej przy stoliku |
| **W3. W2 + dokumenty w mailu** | Jak W2, dodatkowo treść w wiadomości | Gość ma to na piśmie | Cięższa wiadomość, patrz §7 |

**Nasza rekomendacja do przedstawienia prawnikowi:** W2, z brzmieniem
checkboxa mówiącym o czynności, nie o dokumencie — na przykład „Zgadzam się na
jednorazowe użycie mojego adresu do wysłania tego zestawienia", z odnośnikiem
do dokumentu obok, a nie w treści zgody.

## 5. Problem, który jest większy niż checkbox: w zestawieniu są dane innych gości

Zestawienie z założenia pokazuje **kto co zamówił** — a więc pseudonimy
pozostałych uczestników wizyty i ich pozycje. Gość A wysyła na swój prywatny
adres dokument zawierający dane gościa B.

Pseudonim („Wesoły Borsuk") jest daną spseudonimizowaną, ale **przy stoliku
wszyscy wiedzą, kto jest kim**, a zestawienie trafia na skrzynkę firmową razem
z datą, godziną i lokalem. Żaden checkbox odhaczony przez A nie rozstrzyga praw B.

Warianty:

- **Pełne zestawienie** — tak jak dziś. Wymaga rozstrzygnięcia prawnika.
- **Tylko własne pozycje + suma rachunku** — do rozliczenia delegacji wystarcza
  („co zamówiłem ja i ile wynosił cały rachunek"), a dane pozostałych nie
  opuszczają lokalu. Węższe, ale znacznie czystsze.
- **Pełne, ale bez pseudonimów** — „Osoba 1, Osoba 2". Traci sens: rozliczenie
  delegacji potrzebuje wskazania własnych pozycji, a nie cudzych.

Warto zapytać prawnika **zanim** dopiszemy checkbox, bo odpowiedź może zmienić
treść samego zestawienia, a wtedy i klauzula będzie brzmiała inaczej.

## 6. Dowód, że zgoda była — kolizja z obietnicą „nie zapisujemy adresu"

Rozliczalność (art. 5 ust. 2) każe umieć wykazać, że zgoda była. Wykazanie
wprost oznacza zapis: kto, kiedy, na jaką treść. **Kto** to adres e-mail —
a dziś nie zapisujemy go świadomie i mówimy o tym gościowi na dwóch ekranach.

| Wariant | Co zapisujemy | Uwaga |
|---|---|---|
| **A. Nic** | — | Obietnica trzyma. Do obrony wyłącznie przy W1 (brak zgody do wykazania) |
| **B. Ślad bez adresu** | `tableSessionId`, moment, wersja klauzuli | Dowodzi „na tej wizycie o tej godzinie pokazano wersję X i potwierdzono", nie wiąże tego z adresem |
| **C. Skrót adresu** | Jak B + hash | Pozwala wykazać zgodę **dla konkretnego adresu**, ale hash adresu e-mail to nadal dana osobowa i obietnica z ekranu przestaje być prawdziwa |

**Wariant B jest naszą rekomendacją**: kosztuje jedną tabelę, nie tworzy bazy
adresowej i nie zmusza do zmiany zdania, które gość już czyta. Jest słabszy
dowodowo niż C — i to jest właśnie pytanie do prawnika, czy wystarczająco.

Jedno warto zauważyć: **przy wysyłce jednorazowej wycofanie zgody i żądanie
usunięcia nie mają czego dotyczyć** — po wysłaniu nie ma u nas żadnych danych.
To jest argument na naszą korzyść i powinien stać w klauzuli wprost, a nie być
przemilczany.

## 7. Pomysł: dokumenty razem z zestawieniem

Rozważane w pytaniu: dołożyć do wiadomości politykę prywatności i regulamin.

**Regulamin odpada.** Jest umową B2B między nami a restauracją; gość nie jest
jego stroną i nie ma powodu go dostawać. Wysłanie mu go sugeruje stosunek
prawny, którego nie ma.

**Polityka prywatności — zależy od §3.** Jeśli administratorem jest
restauracja, wysyłanie **naszej** polityki jest mylące: opisuje kogoś innego niż
ten, kto odpowiada za te dane.

Załącznik czy odnośnik:

| | Za | Przeciw |
|---|---|---|
| **Załącznik PDF** | Dowodzi, jaką treść gość dostał tamtego dnia | +100–200 kB na wiadomość, wyższa punktacja spamowa, dokument zamraża się w wersji z dnia wysyłki |
| **Odnośnik** | Zawsze aktualny, wiadomość lekka | Nie dowodzi, co gość widział — dokument mógł się zmienić |

**Rekomendacja:** krótka klauzula **w treści** wiadomości (kto administruje,
w jakim celu, że adresu nie zapisaliśmy, gdzie są prawa) plus **trwały
odnośnik**, bez załącznika. Dowód „co widział" bierze się z wersjonowania
klauzuli (§6 wariant B), a nie z pliku doklejonego do maila. Gdyby prawnik
jednak chciał załącznika, PDF ma się generować **z tego samego pliku
markdown**, co strona — inaczej rozjedzie się przy pierwszej zmianie.

## 8. Kolejność prac

| # | Krok | Dlaczego w tym miejscu |
|---|---|---|
| 0 | **Rozstrzygnięcie: kto jest administratorem** (§3) | Blokuje wszystko — decyduje, czyje dane stoją w klauzuli i który dokument dostaje nowy paragraf |
| 1 | **Rozstrzygnięcie: dane innych gości w zestawieniu** (§5) | Może zmienić treść zestawienia, a więc i klauzuli |
| 2 | **Nowy paragraf Polityki** o zestawieniu na e-mail | Luka, która istnieje **już dziś**, niezależnie od reszty. Cztery wersje językowe, ta sama data wersji |
| 3 | **Klauzula w aplikacji gościa**, rozwijana pod formularzem | Wypełnia art. 13 w momencie zbierania danych |
| 4 | **Wersjonowanie klauzuli** — stała z treścią i numerem wersji | Bez tego nie da się wykazać, co gość widział |
| 5 | **Checkbox** — nieodhaczony, o wysyłce, blokujący przycisk | Tylko jeśli prawnik wskaże zgodę jako podstawę |
| 6 | **Ślad zgody bez adresu** (§6 wariant B) | Ma sens dopiero, gdy jest wersja klauzuli do zapisania |
| 7 | **Klauzula w stopce wiadomości** + odnośnik | Domyka drugą stronę: gość ma to też na piśmie |
| 8 | **Testy e2e** | Bez odhaczenia nie da się wysłać; wersja klauzuli trafia do śladu |
| 9 | **Zawiadomienie klientów** o zmianie Polityki | Regulamin §11: 14 dni wyprzedzenia |

Kroki 2 i 3 mają wartość **same z siebie** i nie czekają na checkbox: łatają
stan, w którym zbieramy adres bez jednego zdania o tym, kto go przetwarza.

## 9. Co to kosztuje

Praca w kodzie jest mała: klauzula, checkbox, jedna tabela i testy to około
pół dnia. **Kosztem są dokumenty.** Zmiana Polityki to cztery pliki o tej samej
dacie wersji (CLAUDE.md), przegląd prawnika i czternastodniowe zawiadomienie
klientów. Dlatego warto zebrać ten paragraf razem z innymi zmianami, a nie
wysyłać zawiadomienie dla jednego zdania.

## 10. Ryzyka

- **Tarcie w najgorszym momencie.** Checkbox stoi między gościem a tym, po co
  przyszedł, na telefonie, przy stoliku, po posiłku. Część osób odpadnie.
- **Aplikacja gościa nie jest tłumaczona.** Klauzula będzie po polsku, a strona
  produktowa mówi od wczoraj czterema językami. Obcojęzyczny gość dostanie
  obowiązek informacyjny, którego nie przeczyta — a to jest wada samego
  obowiązku, nie kosmetyka.
- **Piszemy tekst w cudzym imieniu.** Jeśli administratorem jest restauracja,
  to my układamy klauzulę za nią. Regulamin i powierzenie muszą to obejmować.
- **Ślad zgody zmienia obietnicę.** Dziś mówimy „nigdzie go nie zapisujemy".
  Po kroku 6 to nadal będzie prawda co do adresu, ale zdanie trzeba przejrzeć,
  żeby nie obiecywało więcej, niż robimy.
- **Checkbox nie zwalnia z reszty.** Odhaczone pole nie naprawia ani braku
  paragrafu w Polityce, ani danych innych gości w treści. Zbudowany sam,
  daje poczucie zgodności bez zgodności.

## 11. Pytania do prawnika

1. **Kto jest administratorem adresu podanego przy zestawieniu** — restauracja
   (zgodnie z Polityką §1 ust. 2) czy kelbroo, skoro to my decydujemy o celu
   i sposobie tej jednej operacji?
2. **Jaka jest podstawa przetwarzania:** zgoda (art. 6 ust. 1 lit. a), żądanie
   osoby, której dane dotyczą (lit. b), czy prawnie uzasadniony interes (lit. f)?
   Czy wpisanie adresu i kliknięcie „Wyślij" wystarcza jako jednoznaczne
   działanie?
3. **Czy checkbox jest potrzebny**, a jeśli tak — prosimy o brzmienie. Nasze
   założenie: zgoda dotyczy **wysyłki**, nie „akceptacji polityki".
4. **Czy wolno umieszczać w zestawieniu pozycje pozostałych gości** wraz z ich
   pseudonimami (§5), czy dokument ma zawierać wyłącznie pozycje nadawcy i sumę
   rachunku?
5. **Czy ślad zgody bez adresu** (identyfikator wizyty, moment, wersja klauzuli)
   wystarcza do wykazania rozliczalności, czy potrzebny jest skrót adresu?
6. **Prosimy o brzmienie paragrafu Polityki** o zestawieniu na e-mail — dziś
   kod powołuje się na §9, którego nie ma.
7. **Czy wysyłanie dokumentów w załączniku** ma jakąkolwiek wartość dowodową
   ponad wersjonowaną klauzulę, czy wystarczy odnośnik?
8. **Czy klauzula po polsku wystarcza** dla gościa obcojęzycznego, skoro
   aplikacja gościa nie jest tłumaczona?

## 12. Co proponujemy zrobić od razu, bez czekania na odpowiedzi

Kroki 2 i 3 z §8 — paragraf Polityki i klauzula pod formularzem — łatają lukę,
która **istnieje dzisiaj**, i nie zależą od tego, jak prawnik rozstrzygnie
resztę. Wystarczy, że ich brzmienie pójdzie do niego razem z pytaniami; do tego
czasu lepszy jest tekst do poprawienia niż puste miejsce.
