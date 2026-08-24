# kelbroo

Platforma SaaS dla restauracji: gość skanuje kod QR przy stoliku, zamawia i płaci z telefonu, zamówienie trafia do panelu kuchni i kelnera.

Nazwa marki pisana **zawsze małą literą** — `kelbroo`, nigdy „Kelbroo" ani „KELBROO". Tagline: *Self-service dining*.

## Identyfikacja wizualna

Logo: obrys telefonu (teal), w środku klosz kelnerski (pomarańcz) i strzałka wychodząca z kodu QR w górę — „zeskanuj, a jedzenie przyjdzie".

| Token | Wartość | Zastosowanie |
|---|---|---|
| `--teal` | `#2A8F8C` | Kolor podstawowy, wordmark |
| `--teal-bright` | `#37AAA3` | Gradienty, stany hover |
| `--teal-soft` | `#5FC9BE` | Jasny koniec gradientu |
| `--orange` | `#E8722F` | **Wyłącznie akcje i akcenty** |
| `--orange-soft` | `#F7A85C` | Jasny koniec gradientu |
| `--ink` | `#0F2422` | Tekst (czerń z domieszką teal) |
| `--muted` | `#6B807E` | Tekst drugorzędny |
| `--ground` | `#F1F5F4` | Tło strony |

**Dyscyplina koloru:** pomarańcz ma w logo wyłącznie klosz — w interfejsach trafia tylko na główne CTA i pojedyncze akcenty. Wszystko pozostałe jest teal i neutralne. Neutralne nigdy nie są czystą szarością, zawsze mają domieszkę teal.

**Typografia:** Outfit (nagłówki), IBM Plex Sans (tekst), **IBM Plex Mono** (bony kuchenne, numery stolików, kwoty, etykiety) — monospace jest językiem operacyjnym restauracji, nie ozdobnikiem. Plex ma pełne polskie diakrytyki.

## Dokumentacja

Przed implementacją czegokolwiek przeczytaj odpowiedni dokument:

| Dokument | Zakres |
|---|---|
| [docs/todo.md](docs/todo.md) | **Żywy plan realizacji MVP etapu 1** — aktualizowany na bieżąco przy każdej zmianie |
| [docs/product.md](docs/product.md) | Wizja, persony, model biznesowy, zakres MVP, wymagania niefunkcjonalne |
| [docs/architecture.md](docs/architecture.md) | Stack, monorepo, model danych, multi-tenancy, realtime, bezpieczeństwo |
| [docs/01-landing-marketing.md](docs/01-landing-marketing.md) | System 1 — strona produktowa, cennik, zakup abonamentu |
| [docs/02-admin-panel.md](docs/02-admin-panel.md) | System 2 — panel restauracji, stoliki/QR, menu, realizacja zamówień, KDS |
| [docs/03-customer-ordering.md](docs/03-customer-ordering.md) | System 3 — PWA gościa, zamawianie, płatności, oceny |

**Projekt strony głównej** (referencja wizualna dla Systemu 1): [design/landing-page.html](design/landing-page.html) — samodzielny plik HTML, otwierany bezpośrednio w przeglądarce. **Nie jest już serwowany** — treść i style żyją w `apps/web-marketing`, a ten plik zostaje jako punkt odniesienia. Wersja opublikowana: https://claude.ai/code/artifact/e5cfa001-f874-412d-bc9d-847c606328c4

Ten plik jest **źródłem prawdy dla palety, typografii i tonu** przy budowie `apps/web-marketing` — przenieś z niego tokeny CSS i komponenty do Next.js zamiast projektować od nowa.

## Cztery systemy

1. **`apps/web-marketing`** — landing + checkout abonamentu (Next.js SSG/ISR)
2. **`apps/web-admin`** — panel zarządzania + KDS/panel kelnera (Next.js PWA, desktop + iPad + tablet Android)
3. **`apps/web-guest`** — PWA gościa bez rejestracji i bez instalacji (+ `apps/mobile-guest` w React Native, Faza 2)
4. **`apps/web-backoffice`** — zaplecze kelbroo: klienci, abonamenty, blokady, wsparcie

Backend: **`apps/api`** (NestJS + Prisma + PostgreSQL + Redis).

**System 4 obsługuje nas, nie restauracje**, i to go odróżnia od pozostałych trzech.
Jego użytkownik nie należy do żadnej organizacji, więc **nie jest `StaffMember`** —
potrzebuje własnej tożsamości i własnego logowania. Czyta w poprzek najemców, czyli
robi to, przed czym broni RLS: każdy jego ekran musi mieć świadomie wybraną drogę
do danych (patrz [docs/todo.md §6a](docs/todo.md)). Nazwa katalogu celowo nie brzmi
`web-admin` — ta jest zajęta przez panel restauracji i pomylenie tych dwóch
w rozmowie o uprawnieniach kosztowałoby za dużo.

## Domeny produkcyjne

Domena produktowa: **`kelbroo.com`**.

| Adres | Co serwuje | Skąd |
|---|---|---|
| `kelbroo.com` | Strona produktowa (System 1) | `apps/web-marketing` |
| `www.kelbroo.com` | Przekierowanie 301 na apex | Caddy |
| `panel.kelbroo.com` | Panel obsługi (System 2) | `apps/web-admin` |
| `menu.kelbroo.com` | PWA gościa (System 3) | `apps/web-guest` |
| `admin.kelbroo.com` | Zaplecze kelbroo (System 4) | `apps/web-backoffice`, jeszcze nie istnieje |

`/api` i `/socket.io` są serwowane **z tego samego originu co aplikacja**, nie z osobnej
subdomeny — dzięki temu nie ma CORS-u i adres backendu nie jest wkompilowany w bundle.

Wszystkie trzy adresy wskazują na jeden VPS; rozdziela je Caddy po nazwie hosta
([deploy/Caddyfile](deploy/Caddyfile)). Zmiana `GUEST_DOMAIN` wymaga przebudowania
`apps/web-admin` **i przedrukowania kodów QR** — adres jest wpisywany w kod w momencie budowania.

## Kluczowe decyzje projektowe

- **Rynek:** Polska, z architekturą pod ekspansję (wielojęzyczność, wielowalutowość, wymienny provider płatności).
- **Model:** stały abonament miesięczny od restauracji (Menu 0 zł / Starter 159 zł / Pro 349 zł / Enterprise od 899 zł netto), **bez prowizji od zamówień gości**.
- **Gość nigdy się nie rejestruje ani nie instaluje aplikacji.** Natywne appki (Faza 2) są dodatkiem dla stałych klientów, nie warunkiem zamówienia.
- **Panel obsługi to jedna PWA** — nie osobne aplikacje natywne na iPada i Androida.
- **Trzy tryby zamawiania, wybierane przez restaurację:** `prepaid` (płatność w aplikacji), `pay_at_table` (płatność wyłącznie u kelnera — aplikacja nie zawiera żadnej ścieżki płatności), `guest_choice`. Niezależny przełącznik `require_staff_confirmation` wstrzymuje zamówienie do potwierdzenia przez kelnera przy stoliku.
- **`TableSession` (wizyta przy stoliku) jest jednostką rachunku, nie `Order`.** Wiele zamówień i wiele urządzeń gości = jeden rachunek.
- **`TableParticipant` to tożsamość na czas wizyty, nie konto** — nick (wpisany lub wylosowany) + awatar z zamkniętego zestawu, bez uploadu i bez danych osobowych. Podstawa podziału rachunku.
- **Podział rachunku jest funkcją wizyty, nie zamówienia.** Tryby: `none` / `per_person` / `per_item` / `equal` / `groups`. W trybie `prepaid` podział jest wbudowany i domyślny (każdy płaci za własne zamówienie) — nie pokazujemy wtedy ekranu podziału.
- **Arytmetyka podziału: liczby całkowite w groszach, metoda największych reszt, reszta do hosta.** Niezmiennik pokryty testem: suma grup == suma rachunku, suma udziałów pozycji == wartość pozycji.
- **Kelner może zamawiać i edytować w imieniu gościa**, ale każda pozycja niesie trzy niezależne atrybucje: kto dodał (`added_by`), dla kogo jest (`for_participant_id`), kto ostatnio edytował (`last_edited_by`). To zwykle trzy różne osoby.
- **`OrderEvent` jest append-only i jest źródłem prawdy o historii zamówienia.** Pola `last_edited_by*` to tylko denormalizacja pod listę — historii nigdy nie nadpisujemy.
- **`Order.status` i `Order.payment_status` są rozdzielone** — realizacja i rozliczenie to niezależne cykle życia.
- **Bramka do kuchni to status `confirmed`.** W trybie `prepaid` wymaga potwierdzenia płatności webhookiem (nigdy odpowiedzi klienta); w `pay_at_table` — potwierdzenia kelnera. KDS nigdy nie widzi zamówień przed tą bramką.
- **`OrderItem` przechowuje snapshot** nazwy, ceny i modyfikatorów — zmiana cennika nie może zmienić historycznego rachunku.
- **Multi-tenancy przez PostgreSQL RLS** — izolacja danych wymuszona w bazie, nie tylko w kodzie aplikacji.
- **Brak tłumaczenia = fallback na język domyślny restauracji**, nigdy pusty ekran.
- Wygaśnięcie abonamentu wyłącza zamawianie, ale **nigdy nie kasuje danych restauracji**.
- **`FiscalizationProvider` jest abstrakcją od pierwszej linii kodu**, nawet gdy jedyną implementacją jest `Noop`. Trzy docelowe ścieżki: brak / integracja z kasą lokalu (bridge) / kasa wirtualna.

## Kolejność wdrożenia

1. **MVP etap 1** — tryb `pay_at_table`, bez płatności online i bez fiskalizacji. Najkrótsza droga do pierwszego wdrożenia produkcyjnego; omija dwie najdłuższe zależności zewnętrzne.
2. **MVP etap 2** — płatności online (`prepaid`, `guest_choice`) + wybrana ścieżka fiskalizacji.
3. **Faza 2** — wiele lokali, natywne appki gościa, integracje POS, tłumaczenia AI.

## Konwencje

- Monorepo: pnpm workspaces + Turborepo. Współdzielone typy w `packages/types`, komponenty w `packages/ui`, słowniki w `packages/i18n`.
- Ceny zawsze jako `*_cents` (integer), nigdy float.
- Wszystkie kwoty przechowywane z walutą (`currency`) — nie zakładać PLN.
- Język interfejsu dokumentacji i komunikacji: polski. Kod, nazwy zmiennych i commity: angielski.
