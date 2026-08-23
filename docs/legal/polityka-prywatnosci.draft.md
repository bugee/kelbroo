# Polityka prywatności kelbroo — SZKIC

> **Dokument roboczy, nieprzeznaczony do publikacji.** Wsad dla prawnika. Miejsca do
> uzupełnienia oznaczone `[…]`, uwagi w cytatach **Do rozstrzygnięcia**.
> Mapa danych i role RODO: [README.md](README.md).

## 1. Kto odpowiada za dane

kelbroo występuje w **dwóch różnych rolach** i od tego zależy, do kogo kierować pytania.

**Wobec restauracji jako naszego klienta** jesteśmy administratorem: przetwarzamy dane
firmy i osoby zakładającej konto po to, żeby świadczyć i rozliczać usługę.

**Wobec danych powstających w lokalu** — kont pracowników, zamówień, rachunków i danych
gości przy stolikach — administratorem jest **restauracja**, a my przetwarzamy je na jej
polecenie jako podmiot przetwarzający.

Administrator w pierwszej roli: `[pełna nazwa]`, `[adres]`, NIP `[…]`,
kontakt: `kontakt@kelbroo.com`.

> **Do rozstrzygnięcia:** czy wyznaczamy inspektora ochrony danych. Naszym zdaniem
> na tym etapie nie ma takiego obowiązku, ale prosimy o potwierdzenie wobec skali
> przetwarzania danych gości.

## 2. Dane gości restauracji

**Nie pytamy gościa o imię, nazwisko, adres, telefon ani e-mail. Gość nie zakłada konta
i niczego nie instaluje.** To wybór wpisany w konstrukcję usługi, nie deklaracja.

Przetwarzamy natomiast:

| Dane | Po co | Jak długo |
|---|---|---|
| pseudonim losowany przez system (np. „Cichy Borsuk") | rozróżnienie osób przy stoliku | do zamknięcia rachunku |
| znak rozpoznawczy — kształt i kolor | żeby gość mógł przedstawić się kelnerowi | do zamknięcia rachunku |
| treść zamówienia, kwoty, znaczniki czasu | realizacja zamówienia i rachunek | zgodnie z retencją danych restauracji |
| identyfikator sesji zapisany w przeglądarce | rozpoznanie tego samego telefonu w trakcie wizyty | 6 godzin lub do zamknięcia rachunku |
| język interfejsu | wyświetlenie karty w odpowiednim języku | jak wyżej |

Pseudonim jest **losowany przez system**, nie wpisywany przez gościa, i nie jest imieniem.
Znak rozpoznawczy pochodzi z zamkniętego zestawu prostych kształtów i kolorów. Ani jedno,
ani drugie nie pozwala ustalić tożsamości osoby.

Powyższe dane traktujemy jako **dane osobowe o charakterze pseudonimowym** — nie
identyfikują nikogo z imienia, ale w obrębie jednej wizyty pozwalają wyodrębnić konkretne
urządzenie i przypisane mu zamówienie.

> **Do rozstrzygnięcia:** czy taka kwalifikacja jest prawidłowa. Przyjęliśmy ostrożniejszą
> z możliwych — patrz README, sekcja 3b.

**Podstawa prawna:** niezbędność do wykonania usługi zamawiania świadczonej przez
restaurację oraz jej prawnie uzasadniony interes w prowadzeniu ewidencji zamówień
(art. 6 ust. 1 lit. b i f RODO).

## 3. Pamięć przeglądarki gościa

Zapisujemy w przeglądarce gościa **jeden identyfikator sesji**, powiązany z konkretnym
stolikiem. Bez niego gość po odświeżeniu strony traciłby swoje zamówienie i rachunek.

**Nie stosujemy plików cookie do celów analitycznych, marketingowych ani profilowania.
Nie przekazujemy danych gości do żadnych narzędzi reklamowych.**

> **Do rozstrzygnięcia:** czy identyfikator techniczne niezbędny wymaga banera zgody.
> Naszym zdaniem nie (art. 173 ust. 3 Prawa telekomunikacyjnego), ale wymaga opisania —
> co robi ten rozdział.

## 4. Dane pracowników restauracji

Przetwarzamy je **na polecenie restauracji**, która jest ich administratorem:
imię i nazwisko, służbowy adres e-mail, skrót hasła, rolę w systemie, datę ostatniego
logowania oraz dziennik działań w panelu.

Dziennik działań zapisuje, kto zmienił zamówienie, kto rozliczył rachunek i kto wpuścił
gościa do stolika. Służy rozliczalności przy operacjach na pieniądzach i **nie jest
nadpisywany**.

Pracownik kierujący żądanie dotyczące swoich danych — wglądu, sprostowania, usunięcia —
powinien zwrócić się **do swojego pracodawcy**, czyli restauracji. Przekażemy takie
żądanie restauracji i wykonamy jej polecenie.

## 5. Dane klienta — restauracji

Tu jesteśmy administratorem. Przetwarzamy nazwę firmy, NIP, adres i e-mail rozliczeniowy,
dane osoby zakładającej konto oraz historię abonamentu.

**Podstawa prawna:** wykonanie umowy (art. 6 ust. 1 lit. b), obowiązki podatkowe
i rachunkowe (lit. c) oraz dochodzenie roszczeń (lit. f).

**Okres przechowywania:** przez czas trwania umowy, a dane rozliczeniowe przez okres
wymagany przepisami podatkowymi — `[5 lat od końca roku podatkowego]`.

## 6. Komu przekazujemy dane

| Podmiot | W jakim celu |
|---|---|
| `[dostawca infrastruktury]` | hosting serwera i bazy danych |
| Hostinger | wysyłka wiadomości e-mail |
| `[operator płatności]` | rozliczenie abonamentu (funkcja planowana) |

Nie sprzedajemy danych i nie udostępniamy ich w celach marketingowych.

> **Do rozstrzygnięcia:** czy którykolwiek dostawca przetwarza dane poza EOG.

## 7. Bezpieczeństwo

- Dane każdej restauracji są **odseparowane na poziomie bazy danych** mechanizmem
  Row-Level Security, nie tylko regułami w kodzie aplikacji.
- Hasła przechowujemy wyłącznie jako skrót (bcrypt) — nie znamy haseł pracowników.
- Cała komunikacja szyfrowana (HTTPS), certyfikaty odnawiane automatycznie.
- Kopie zapasowe bazy: `[częstotliwość i okres przechowywania]`.
- Dostęp do środowiska produkcyjnego ograniczony do `[zakres osób]`.

## 8. Prawa osób, których dane dotyczą

Prawo dostępu, sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych
oraz sprzeciwu, a także prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych
Osobowych.

**Gdzie kierować żądanie:** jeśli dotyczy zamówienia złożonego w lokalu albo konta
pracownika — do restauracji jako administratora. Jeśli dotyczy naszej relacji z klientem
— na `kontakt@kelbroo.com`.

> **Do rozstrzygnięcia:** jak w praktyce zrealizować żądanie usunięcia danych gościa,
> skoro nie umiemy go zidentyfikować — nie zbieramy nic, co pozwoliłoby powiązać żądanie
> z konkretnym rekordem. Naszym zdaniem to skutek minimalizacji danych, a nie brak
> mechanizmu (art. 11 RODO), ale wymaga to opisania.

## 9. Funkcje planowane, jeszcze niewdrożone

Wymieniamy je z wyprzedzeniem, bo **rozszerzą zakres przetwarzania**:

1. **Zestawienie rachunku na e-mail** — gość poda adres e-mail. Adres wykorzystamy
   wyłącznie do wysłania tego jednego zestawienia i `[nie zapiszemy go / usuniemy po …]`.
2. **Ocena dania z komentarzem** — pole tekstowe swobodne; gość może wpisać w nie
   cokolwiek, w tym dane osobowe.
3. **Płatności online** — realizowane przez zewnętrznego operatora. **Nie będziemy
   przetwarzać ani przechowywać danych kart płatniczych.**

> **Do rozstrzygnięcia:** czy opisywać funkcje jeszcze niedziałające, czy zaktualizować
> politykę przy ich wdrożeniu. Naszym zdaniem lepiej opisać teraz — inaczej wdrożenie
> wymaga zmiany polityki i ponownego zawiadomienia klientów.

## 10. Zmiany polityki

O istotnych zmianach zawiadomimy klientów na adres e-mail wskazany przy rejestracji,
z `[termin]` wyprzedzeniem.

Wersja z dnia `[data]`.
