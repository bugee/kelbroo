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

> **Do prawnika idzie osobny dokument:** [pytania-do-prawnika.md](pytania-do-prawnika.md).
> Zawiera wyciąg z tej sekcji i z §8, bez części technicznej — samodzielny, więc
> nie trzeba do niego czytać niczego innego. Ten plik zostaje rejestrem
> inżynierskim: co dokument obiecuje i co kod robi naprawdę.


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

**Rejestr zamknięty 2026-08-28.** Prawnik odpowiedział na komplet pytań z części A–D
[briefu](pytania-do-prawnika.md) i dostarczył nowe brzmienia obu dokumentów. Regulamin
i Polityka mają wersję z 28 sierpnia i **opisują stan faktyczny**.

Historia tego rejestru jest warta zachowania, bo pokazuje, czym te rozbieżności były:
pięć pozycji powstało z rozjazdu dokumentu z kodem, dwie **dopiero wraz z przyjmowaniem
pieniędzy**, a żadna nie została zamknięta przez naginanie kodu do dokumentu.

### Jak zostały domknięte

| Pozycja | Rozstrzygnięcie |
|---|---|
| **PayU wśród odbiorców danych** | Dopisane do Polityki 27.08, potwierdzone 28.08 wraz z pełnymi danymi rejestrowymi. PayU jest **odrębnym administratorem**; umowa powierzenia nie jest właściwym instrumentem i jej nie zawieramy |
| **Okres rozliczeniowy i ceny roczne** | Poprawione 27.08, potwierdzone 28.08. Liczenie od dnia zakupu z przycięciem dnia zostało uznane za uczciwsze wobec klienta i zgodne z prawem B2B |
| **„Tryb do odczytu" po wygaśnięciu** | Zapis złagodzony (Regulamin §6): zawieszenie blokuje **nowe** zamówienia, ale rozliczanie otwartych rachunków i wydawanie z kuchni zostaje. Dokument dogonił kod |
| **Usuwanie danych po 6 miesiącach** | Zmienione na **anonimizację** z **30-dniowym powiadomieniem** (Regulamin §6 ust. 3, Polityka §5). **Kodu nadal nie ma** — patrz niżej |
| **Wypowiedzenie „z poziomu panelu"** | Skreślone. Zostaje droga mailowa (Regulamin §9), czyli to, co faktycznie działa |
| **Brak zapisu o SLA** | Regulamin §8 mówi wprost, że **SLA nie udzielamy** |
| **Umowa powierzenia (DPA)** | Wbudowana w Regulamin §10 — bez osobnego dokumentu do podpisu przy rejestracji |
| **Dostęp wsparcia do konta klienta** | Regulamin §3 ust. 3: wyłącznie **na żądanie klienta** i z zapisem w dzienniku. Funkcji nie ma — patrz niżej |
| **Płatności gości** | Regulamin §7: środki idą wprost na konto klienta u operatora, my nie pośredniczymy. Klient upoważnia nas do przechowywania kluczy API i inicjowania transakcji. **Bez licencji KNF** — nie jesteśmy dostawcą usług płatniczych w rozumieniu PSD2 |
| **Adres e-mail gościa przy płatności** | Polityka §2 ma wyjątek: adres jednorazowy, przekazywany operatorowi, **nietrwały** |

### Co z tego wynika dla kodu — dwa zobowiązania bez pokrycia

Dokumenty są teraz zgodne ze stanem faktycznym **z dwoma wyjątkami**, które
przestały być rozbieżnością tekstu, a stały się **zadaniem do wykonania**:

1. **Anonimizacja po 6 miesiącach i powiadomienie 30 dni wcześniej.** Żaden mechanizm
   retencji nie istnieje. Zmiana z „usuwamy" na „anonimizujemy" jest dla nas
   korzystniejsza (statystyki zostają), ale **dokłada** obowiązek: wysyłkę
   powiadomienia z wyprzedzeniem. Pierwszy termin zapadnie sześć miesięcy po
   pierwszym wygasłym koncie.
2. **Rejestrowanie dostępu wsparcia.** Regulamin §3 ust. 3 obiecuje ślad w dzienniku.
   Funkcji „wejdź na konto klienta" nie ma wcale, więc dziś nikt nią nie wchodzi —
   ale jeśli powstanie, dziennik musi powstać razem z nią, a nie po niej.

Oba są zapisane w [docs/todo.md](../todo.md).

### Zmiana po zamknięciu rejestru

**Polityka §3, wersja 2026-08-29.** Zdanie „nie używamy narzędzi śledzących ani
reklamowych" dotyczyło całej platformy i przestało być prawdziwe, gdy strona
produktowa dostała Google Analytics. Paragraf mówi teraz osobno o aplikacji Gościa
(bez narzędzi śledzących, i tak ma zostać) i o `kelbroo.com` (analityka wyłącznie
po zgodzie, do wycofania ze stopki).

Warto zapamiętać wzorzec, bo powtórzył się w tej sekcji trzy razy: **funkcja
dopisana do produktu potrafi unieważnić zdanie w dokumencie prawnym**, a zauważa się
to dopiero wtedy, gdy ktoś czyta oba naraz. Regulamin zostaje przy wersji 2026-08-28.

## Wersje językowe

Dokumenty istnieją w czterech językach: `regulamin.md` (polski, **wiążący**) oraz
`regulamin.en.md`, `regulamin.de.md`, `regulamin.es.md`. Tak samo polityka
prywatności. Każde tłumaczenie niesie na górze klauzulę, że w razie rozbieżności
wiąże wersja polska — umowa jest zawierana po polsku i tylko ta wersja podlega
interpretacji.

**Zmiana dokumentu to zmiana czterech plików.** Wersja (`_Wersja RRRR-MM-DD_`)
musi być w nich identyczna: klient zgadza się na konkretną wersję przy
rejestracji, a rozbieżna data w tłumaczeniu podważałaby, na co dokładnie.
Strona nie podmienia brakującego tłumaczenia na polskie — budowanie pada,
i to jest zamierzone.
