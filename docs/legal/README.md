# Wsad dla prawnika — kelbroo

| Plik | Co zawiera |
|---|---|
| [regulamin.md](regulamin.md) | **Obowiązujący regulamin** — publikowany pod `/regulamin` |
| [polityka-prywatnosci.md](polityka-prywatnosci.md) | **Obowiązująca polityka prywatności** — publikowana pod `/prywatnosc` |
| ten plik | Mapa danych, role RODO i rozbieżności do zamknięcia |

**Te pliki są źródłem prawdy dla stron publikowanych na `kelbroo.com`** — aplikacja
marketingowa renderuje je wprost, żeby opublikowana treść nie mogła rozjechać się
z repozytorium. Zmiana treści = zmiana wersji w nagłówku dokumentu **i** w stałych
`TERMS_VERSION` / `PRIVACY_VERSION` (`apps/web-marketing/lib/api.ts`), bo rejestracja
zapisuje przy zgodzie wersję, na którą klient przystał.

Wcześniejsze szkice dla prawnika zostały zastąpione tymi dokumentami i usunięte —
dwa komplety w jednym katalogu to proszenie się o opublikowanie nie tego.

---

## 1. Czym jest usługa

Platforma SaaS dla restauracji. Gość skanuje kod QR przy stoliku, przegląda kartę
i składa zamówienie z własnego telefonu; zamówienie trafia do panelu obsługi i na
ekran kuchni. Rozliczenie odbywa się u kelnera — **w obecnej wersji nie ma płatności
online ani fiskalizacji po naszej stronie**.

Klientem jest restauracja, płacąca abonament miesięczny. Gość nigdy nie zakłada konta,
nie instaluje aplikacji i nie podaje danych osobowych.

Adresy: `kelbroo.com` (strona produktowa), `panel.kelbroo.com` (panel obsługi),
`menu.kelbroo.com` (aplikacja gościa).

## 2. Role w rozumieniu RODO — najważniejsza rzecz w tym dokumencie

kelbroo występuje w **dwóch rolach jednocześnie** i to determinuje kształt obu dokumentów.

**Administrator** — wobec danych naszego klienta, czyli restauracji: dane firmy,
NIP, adres rozliczeniowy, dane osoby zakładającej konto, historia płatności abonamentu.
Tu przetwarzamy we własnym celu.

**Podmiot przetwarzający** — wobec wszystkiego, co powstaje w lokalu: kont pracowników
restauracji, zamówień, rachunków i danych gości przy stolikach. Administratorem jest
restauracja; my przetwarzamy na jej polecenie.

> **Do rozstrzygnięcia:** czy potrzebna jest osobna **umowa powierzenia przetwarzania**
> (DPA) jako załącznik do regulaminu, czy wystarczy rozdział w samym regulaminie.
> Wymaga tego art. 28 RODO i nie da się tego pominąć — pytanie dotyczy formy.

## 3. Mapa danych — stan faktyczny

### 3a. Pracownicy restauracji (rola: podmiot przetwarzający)

| Dane | Skąd | Po co |
|---|---|---|
| imię i nazwisko | wpisuje restauracja | podpis pod działaniem w panelu |
| adres e-mail | wpisuje restauracja | logowanie |
| skrót hasła (bcrypt) | ustawia pracownik | uwierzytelnienie |
| rola (owner / manager / waiter / kitchen) | restauracja | uprawnienia |
| data ostatniego logowania | system | bezpieczeństwo |
| dziennik działań (`AuditLog`) | system | kto zmienił rachunek, kto wpuścił gościa, kto rozliczył wizytę |

Dziennik działań jest **nieusuwalny w toku normalnej pracy** — to zapis rozliczalności
przy operacjach na pieniądzach.

> **Do rozstrzygnięcia:** okres przechowywania dziennika i podstawa prawna wobec
> pracownika. Nasza propozycja: prawnie uzasadniony interes restauracji (art. 6 ust. 1
> lit. f), retencja związana z okresem przedawnienia roszczeń.

### 3b. Goście restauracji (rola: podmiot przetwarzający)

**Nie zbieramy o gościu żadnych danych identyfikujących.** Nie ma rejestracji, nie ma
imienia, adresu, telefonu ani zdjęcia. Zamiast tego:

| Dane | Charakter |
|---|---|
| pseudonim losowany przez system (np. „Cichy Borsuk") | generowany, nie wpisywany |
| znak rozpoznawczy: kształt + kolor | z zamkniętego zestawu, do wypowiedzenia kelnerowi |
| treść zamówienia i kwoty | dane transakcyjne wizyty |
| skrót tokenu sesji w bazie, token w pamięci przeglądarki | rozpoznanie tego samego telefonu w trakcie wizyty |
| język interfejsu, znaczniki czasu | działanie usługi |

Token sesji żyje domyślnie 6 godzin i wygasa wraz z zamknięciem rachunku.

> **Do rozstrzygnięcia — kluczowe:** czy powyższe stanowi dane osobowe. Naszym zdaniem
> **tak**, mimo braku danych identyfikujących: token pozwala wyodrębnić konkretną osobę
> w obrębie wizyty (motyw 26 RODO). Dokumenty napisaliśmy przy tym założeniu, jako
> ostrożniejszym. Prosimy o potwierdzenie albo korektę.

> **Do rozstrzygnięcia:** token w `localStorage` jest **techniczne niezbędny** do
> działania usługi — bez niego gość po odświeżeniu strony traci swoje zamówienie. Naszym
> zdaniem nie wymaga banera zgody (art. 173 Prawa telekomunikacyjnego), ale musi być
> opisany. Prosimy o potwierdzenie.

### 3c. Funkcje zaplanowane, jeszcze niewdrożone

Wymieniamy je, bo **przekroczą obecny zakres** i lepiej objąć je dokumentami od razu:

- **Zestawienie rachunku na e-mail** — gość poda adres. To już jednoznacznie dane osobowe.
- **Ocena dania z komentarzem** — pole tekstowe swobodne, może zawierać cokolwiek.
- **Płatności online** — dopiero etap 2; obecnie **nie dotykamy danych kartowych**.

### 3d. Klient (rola: administrator)

Nazwa firmy, NIP, adres rozliczeniowy, e-mail rozliczeniowy, dane osoby zakładającej
konto, plan abonamentowy i historia płatności.

## 4. Podmioty, którym powierzamy dane

| Podmiot | Rola | Uwaga |
|---|---|---|
| `[dostawca VPS — do uzupełnienia]` | hosting | serwer w `[lokalizacja]` |
| Hostinger | poczta wychodząca (SMTP) | nadawca `kontakt@kelbroo.com` |
| `[operator płatności]` | rozliczenie abonamentu | etap 2, jeszcze niewdrożone |

> **Do rozstrzygnięcia:** czy którykolwiek z dostawców przetwarza dane **poza EOG**
> i czy potrzebne są standardowe klauzule umowne.

## 5. Bezpieczeństwo — fakty, nie deklaracje

- Izolacja danych między restauracjami wymuszona w bazie danych (PostgreSQL
  Row-Level Security), nie tylko w kodzie aplikacji.
- Hasła pracowników przechowywane jako skrót bcrypt.
- Cały ruch po HTTPS, certyfikaty odnawiane automatycznie.
- Kopie zapasowe bazy: `[częstotliwość i retencja — do uzupełnienia]`.
- Dostęp do bazy produkcyjnej: `[kto — do uzupełnienia]`.

## 6. Model cenowy do regulaminu

| Plan | Cena netto / mies. |
|---|---|
| Menu | 0 zł |
| Starter | 159 zł |
| Pro | 349 zł |
| Enterprise | od 899 zł |

Okres próbny: **14 dni planu Pro, bez podania karty**. Po jego wygaśnięciu zamawianie
przez gości zostaje wyłączone, ale **dane restauracji nie są kasowane**.

> **Do rozstrzygnięcia:** po jakim czasie od wygaśnięcia abonamentu wolno nam trwale
> usunąć dane nieaktywnego klienta i jak go o tym zawiadomić.

## 7. Pozostałe pytania otwarte

1. Czy plan Menu (0 zł) w ogóle wchodzi do oferty — wpływa na zakres regulaminu.
2. Czy restauracja może wypowiedzieć umowę w dowolnym momencie ze skutkiem na koniec
   okresu rozliczeniowego, czy obowiązuje okres wypowiedzenia.
3. Odpowiedzialność za przerwy w działaniu — czy deklarujemy SLA. Naszym zdaniem
   **nie na tym etapie**, ale musi to być w regulaminie napisane wprost.
4. Kto odpowiada za zgodność treści karty menu (alergeny, składy) — naszym zdaniem
   restauracja, i regulamin powinien to przesądzać.
5. Czy potrzebny jest osobny regulamin dla gościa, skoro gość nie zawiera z nami umowy
   ani nie zakłada konta.

---

## 8. Rozbieżności między dokumentami a działającym systemem

Sprawdzone z kodem 2026-08-24, zweryfikowane ponownie po dodaniu rejestracji.
**Trzy obietnice nadal nie mają pokrycia**, jedna została domknięta. Nie unieważnia
to dokumentów, ale każdą trzeba zamknąć kodem albo poprawką w treści.

### Otwarte

1. **Regulamin §7 ust. 1 — „panel obsługi pozostaje w trybie do odczytu".**
   Wygaśnięcie abonamentu wyłącza dziś zamawianie **przez gości**, ale kelner nadal
   składa zamówienia z panelu bez żadnej przeszkody. To najostrzejsza z rozbieżności,
   bo dotyczy egzekwowania płatności: lokal, który przestał płacić, pracuje dalej.
   *Domknięcie:* sprawdzenie abonamentu w `staff-ordering.service.ts`, obok tego,
   które już jest w `table.service.ts`.

2. **Regulamin §7 ust. 3 i Polityka §5 — usunięcie danych po 6 miesiącach.**
   Żaden mechanizm retencji nie istnieje; nic się samo nie kasuje i nikt nie liczy
   tych sześciu miesięcy. Deklarujemy w polityce prywatności usuwanie, którego
   nie wykonujemy — to zobowiązanie wobec osób, których dane dotyczą, nie tylko
   wobec klienta. *Domknięcie:* zadanie cykliczne plus decyzja, co dokładnie kasujemy
   (całą organizację czy same dane osobowe, zostawiając statystyki).

3. **Regulamin §7 ust. 2 — wypowiedzenie „z poziomu panelu Konta".**
   W panelu nie ma takiej funkcji. Najłagodniejsza z trzech, bo dokument dopuszcza
   też drogę mailową i klient nie zostaje bez wyjścia. *Domknięcie:* przycisk
   w ustawieniach albo skreślenie tych czterech słów z regulaminu.

### Domknięte

4. ~~**Polityka §5 — NIP i adres działalności.**~~ NIP zbieramy od 2026-08-24,
   ze sprawdzeniem sumy kontrolnej. **Adresu działalności nadal nie zbieramy** —
   przy pierwszej fakturze VAT i tak będzie potrzebny, więc zostaje do dołożenia
   razem z fakturowaniem.

> Do potwierdzenia przez Ciebie, bo tego nie sprawdzę z kodu: czy infrastruktura
> naprawdę stoi we **Frankfurcie** (Polityka §6) — dokument opiera na tym twierdzenie
> o braku transferu poza EOG, a to jedno z mocniejszych zdań w całej polityce.
