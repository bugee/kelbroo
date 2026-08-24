# Polityka prywatności platformy kelbroo

_Wersja 2026-08-24_

Niniejsza Polityka prywatności określa zasady przetwarzania danych osobowych w ramach systemu kelbroo. Została przygotowana z naciskiem na maksymalną przejrzystość i ochronę prywatności korzystających z niej osób.

## §1. Kto odpowiada za dane (Dwie role na gruncie RODO)

Platforma kelbroo występuje w dwóch różnych rolach, w zależności od tego, z jakich funkcji systemu korzystasz:

1. **Administrator danych** – w stosunku do danych podawanych przez **Klienta** (przedsiębiorcę prowadzącego restaurację) w celu zawarcia umowy, administratorem danych jest Usługodawca.

* **Dane Administratora:** Kelbroo, ul. Rodła 24/4, 01-496 Warszawa, NIP: 5222269366. Kontakt we wszystkich sprawach związanych z danymi: `kontakt@kelbroo.com`. Ze względu na charakter usługi i brak przetwarzania danych wrażliwych na dużą skalę, Usługodawca nie powołuje Inspektora Ochrony Danych.

2. **Podmiot przetwarzający (Procesor)** – w stosunku do danych powstających fizycznie w lokalu, w tym kont **Pracowników**, zapisów zamówień oraz identyfikatorów cyfrowych **Gości**, administratorem jest **Klient** (restauracja). Względem tych danych Usługodawca pełni jedynie rolę podmiotu przetwarzającego, realizując udokumentowane polecenia Klienta na potrzeby dostarczenia oprogramowania (Usługi).

## §2. Przetwarzanie danych Gości restauracji

Model działania Usługi kelbroo opiera się na zasadzie minimalizacji danych. **Gość nie zakłada Konta, nie instaluje żadnej aplikacji i nie jest proszony o podanie imienia, nazwiska, numeru telefonu ani adresu e-mail**.

W celu prawidłowej realizacji zamówienia za pomocą skanowanego kodu QR, system przetwarza w imieniu Klienta wyłącznie dane o charakterze pseudonimowym:

| Kategoria danych | Cel przetwarzania | Czas przechowywania |
| --- | --- | --- |
| **Pseudonim** (np. „Cichy Borsuk”) | Wyodrębnienie poszczególnych osób siedzących przy tym samym stoliku. System losuje go automatycznie. | Do momentu zamknięcia rachunku lub wygaśnięcia sesji. |
| **Znak rozpoznawczy** (kształt i kolor) | Umożliwienie Gościowi werbalnej identyfikacji zamówienia przed kelnerem (wybór z zamkniętego zestawu). | Do momentu zamknięcia rachunku. |
| **Dane transakcyjne** | Realizacja zamówienia (treść zamówienia, kwoty, dokładne znaczniki czasu). | Zgodnie z czasem retencji wyznaczonym na Koncie Klienta. |
| **Język interfejsu** | Wyświetlanie karty menu w języku wybranym przez Gościa na swoim urządzeniu. | Przez cały czas trwania wizyty. |

*Podstawa prawna (po stronie Klienta):* Przetwarzanie jest niezbędne do wykonania usługi gastronomicznej zamawianej przez Gościa (art. 6 ust. 1 lit. b RODO) oraz realizuje prawnie uzasadniony interes Klienta, jakim jest prowadzenie bieżącej ewidencji rachunków (art. 6 ust. 1 lit. f RODO).

## §3. Identyfikatory w przeglądarce Gościa (Token sesji)

W pamięci przeglądarki na urządzeniu Gościa zapisywany jest **wyłącznie jeden identyfikator sesji (token)**, służący do powiązania jego telefonu z zamówieniem na stoliku.

* **Brak narzędzi śledzących:** Usługodawca nie stosuje jakichkolwiek plików cookie (ciasteczek) w celach analitycznych, marketingowych czy profilowania użytkowników. Dane Gości nie trafiają do sieci reklamowych.

* **Techniczna niezbędność i brak wymogu zgody:** Zapisanie tokenu sesji w lokalnej pamięci (np. *localStorage*) jest **technicznie niezbędne** do świadczenia Usługi na żądanie Gościa. Zapobiega to utracie całej historii zamówienia i przypisania do stolika w przypadku odświeżenia strony przeglądarki. W związku z tym (w oparciu o art. 173 ust. 3 ustawy Prawo telekomunikacyjne), umieszczenie tego identyfikatora **nie wymaga uzyskiwania odrębnej zgody** ze strony Gościa (brak tzw. banera cookie).

* **Wygaśnięcie:** Token jest ważny domyślnie przez 6 godzin od jego utworzenia lub wygasa automatycznie wraz z rozliczeniem stolika.

## §4. Przetwarzanie danych Pracowników

Jako podmiot przetwarzający na polecenie Klienta (pracodawcy), Usługodawca przetwarza niezbędne dane Pracowników nadających lub realizujących zamówienia:

* **Zakres danych:** Imię i nazwisko (wykorzystywane jako podpis pod operacją), służbowy e-mail, ranga/rola w systemie oraz data ostatniego logowania. Usługodawca nie zna haseł Pracowników – są one zabezpieczane bezpiecznym skrótem kryptograficznym (bcrypt).

* **Dziennik działań (Audit Log):** System automatycznie zapisuje operacje finansowe w panelu (np. kto zmodyfikował pozycje rachunku lub kto rozliczył Gościa). Dziennik ten – z uwagi na rozliczalność obrotu pieniężnego – **nie podlega nadpisywaniu w toku normalnej pracy** i chroni interesy finansowe Klienta.

Wszelkie żądania dotyczące edycji lub usunięcia swoich danych Pracownik powinien zgłaszać bezpośrednio do administratora danych, czyli Klienta.

## §5. Przetwarzanie danych Klienta (Restauracji)

W celach biznesowych, Usługodawca (jako administrator) gromadzi dane Klientów posiadających aktywne Konto w systemie SaaS.

* **Zakres danych:** Nazwa firmy, numer NIP, adres działalności, adres e-mail, dane osoby zakładającej Konto na rzecz firmy, wybrany plan abonamentowy oraz historia rozliczeń.

* **Cel i podstawa prawna:** Zawarcie i wykonanie umowy B2B (art. 6 ust. 1 lit. b RODO), wywiązywanie się z ciążących na Usługodawcy obowiązków podatkowo-księgowych (art. 6 ust. 1 lit. c RODO) oraz zabezpieczenie i ewentualne dochodzenie roszczeń (art. 6 ust. 1 lit. f RODO).

* **Czas przechowywania (retencja):** Po zakończeniu współpracy (wypowiedzenie umowy lub nieopłacenie abonamentu), dane w panelu Klienta nie są natychmiastowo niszczone. Dane nieaktywnych Kont restauracji są bezpowrotnie i **trwale usuwane po upływie 6 miesięcy od wygaśnięcia opłaconego abonamentu**. Niezależnie od tego, wybrane dane rozliczeniowe i faktury przechowujemy przez wymagany przepisami okres 5 lat, licząc od końca roku podatkowego.

## §6. Odbiorcy danych i zasady transferu (EOG)

Dane wprowadzane do Usługi są powierzane podmiotom trzecim wyłącznie w wymiarze technicznym niezbędnym do podtrzymania działania platformy:

* **Infrastruktura serwerowa i poczta wychodząca (SMTP):** Usługi świadczy firma **Hostinger.com**.

* **Lokalizacja i brak transferu:** Całość serwerów i macierzy bazodanowych zlokalizowana jest **we Frankfurcie na terenie Niemiec**. Oznacza to, że Usługodawca **nie przekazuje danych poza Europejski Obszar Gospodarczy (EOG)**.
Usługodawca stanowczo oświadcza, że w żadnym wypadku nie odsprzedaje profili Klientów ani Gości w celach marketingowych.

## §7. Bezpieczeństwo i poufność

Dla pełnej ochrony wprowadzonych danych, system wykorzystuje poniższe standardy bezpieczeństwa:

* **Izolacja na poziomie bazy danych:** Zapytania w aplikacji są separowane mechanizmem Row-Level Security, co daje fizyczną gwarancję, że personel jednego lokalu nie zyska wglądu w dane i rachunki innej restauracji.

* **Kryptografia i komunikacja:** Szyfrowanie ciągów znaków wrażliwych (bcrypt) oraz odnawiane automatycznie certyfikaty SSL/TLS dla połączeń w standardzie HTTPS.

* **Bezpieczeństwo dostępu:** Ograniczenie bezpośredniego dostępu do bazy produkcyjnej tylko dla kluczowych członków zespołu Usługodawcy.

## §8. Prawa przysługujące osobom, których dane dotyczą

Zgodnie z RODO, osobom, których dane są przetwarzane, przysługuje prawo: dostępu do swoich danych, żądania ich sprostowania, usunięcia lub ograniczenia przetwarzania, wniesienia sprzeciwu wobec przetwarzania, przenoszenia danych, a także prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych.

**Droga zgłaszania żądań:**

* Jeżeli sprawa dotyczy Konta restauracji (Klienta), wniosek należy przesłać na adres: `kontakt@kelbroo.com`.

* Jeżeli wniosek składa Gość albo Pracownik, właściwym adresem do zgłaszania żądań jest bezpośredni kontakt z zarządcą danego lokalu gastronomicznego (który w świetle prawa jest administratorem tych danych).

**Ograniczenia względem danych Gości (Art. 11 RODO):**
Gdy zgłoszenie dotyczy prośby o usunięcie informacji o zamówieniu wystosowanej przez Gościa, Usługodawca (działający w imieniu Klienta) zawiadamia, że proces składania zamówienia bazuje na głębokiej pseudonimizacji. Brak imienia, nazwiska czy powiązanego adresu e-mail sprawia, że **nie jesteśmy w stanie przypisać zgłoszenia do konkretnego, historycznego rekordu w bazie**. Powołując się na dyspozycję art. 11 ust. 1 i 2 RODO, Usługodawca i Klient są zwolnieni z obowiązku sztucznego pozyskiwania dodatkowych danych identyfikujących w celu realizacji praw żądającego, jeśli pierwotny cel systemu tego nie wymagał.

## §9. Funkcje planowane (wdrażane fazowo)

Niniejsza Polityka obejmuje z góry również planowane moduły, które mogą wymagać szerszego przetwarzania danych w przyszłości:

1. **Wysyłka e-paragonu lub zestawienia (opcja):** W przypadku udostępnienia takiej opcji, zadeklarowany jednorazowo przez Gościa adres e-mail wykorzystany zostanie wyłącznie do dostarczenia podsumowania zamówienia, a następnie usunięty (nie zasilając żadnych baz newsletterowych).

2. **Komentarze do zamówień:** Moduł swobodnych tekstowo ocen pozostawia Gościowi pełną decyzyjność, czy zamieści w nich dane dobrowolne mogące prowadzić do identyfikacji.

3. **Bramka płatności online:** Po udostępnieniu rozliczeń online (np. Apple Pay / BLIK), dostawcą technologii i jedynym powiernikiem danych transakcyjnych karty będzie dedykowany operator płatności. Kelbroo nie będzie przetwarzać ani archiwizować wrażliwych ciągów numerów kart płatniczych.

## §10. Zmiany Polityki prywatności

O wszelkich istotnych modyfikacjach niniejszego dokumentu, Klienci powiadamiani będą na przypisany adres poczty elektronicznej z zachowaniem 14-dniowego wyprzedzenia.

Dokument wchodzi w życie z dniem opublikowania na stronie internetowej platformy kelbroo.