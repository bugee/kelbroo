# kelbroo — Architektura techniczna

> Status: draft v0.1 · 2026-08-22
> Dokument nadrzędny produktowy: [product.md](product.md)

## 1. Przegląd architektury

kelbroo to wielodostępowa (multi-tenant) platforma SaaS złożona z jednego backendu i trzech aplikacji frontendowych. Wszystkie klienty komunikują się z tym samym API; różnicuje je zakres uprawnień i sposób uwierzytelniania.

```
┌──────────────────┐   ┌───────────────────┐   ┌────────────────────┐
│ 1. Landing/      │   │ 2. Admin Panel    │   │ 3. Guest App       │
│    Marketing     │   │    (web + tablet) │   │    (PWA + natywne) │
│  Next.js SSG/SSR │   │  Next.js (SPA)    │   │  Next.js PWA       │
│                  │   │  PWA offline      │   │  React Native (F2) │
└────────┬─────────┘   └─────────┬─────────┘   └─────────┬──────────┘
         │                       │                       │
         │  REST/tRPC + WebSocket (realtime)              │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │   API Backend          │
                    │   Node.js (NestJS)     │
                    │   Auth · Orders · Menu │
                    │   Billing · Realtime   │
                    └───────────┬────────────┘
                                │
     ┌──────────────┬───────────┼────────────┬──────────────┐
     ▼              ▼           ▼            ▼              ▼
┌─────────┐  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐
│PostgreSQL│ │  Redis   │ │  S3/R2   │ │  Stripe  │ │ Przelewy24  │
│  (RLS)   │ │pub/sub+  │ │ zdjęcia  │ │ Billing  │ │ /BLIK       │
│          │ │  cache   │ │  menu    │ │(abonament│ │(płatn.gości)│
└─────────┘  └──────────┘ └──────────┘ └──────────┘ └─────────────┘
```

## 2. Stack technologiczny

### Decyzje i uzasadnienie

| Warstwa | Wybór | Uzasadnienie |
|---|---|---|
| Frontend (wszystkie 3 web) | **Next.js 15 (App Router) + TypeScript** | Jeden framework dla SSG (SEO landingu), SSR i SPA; wspólne komponenty i typy w monorepo |
| UI | **Tailwind CSS + shadcn/ui** | Szybkie budowanie spójnego design systemu, dobre wsparcie dostępności |
| Stan / dane | **TanStack Query + Zustand** | Cache serwerowy z automatyczną inwalidacją; lekki stan lokalny (koszyk) |
| Backend | **NestJS (Node.js + TypeScript)** | Modularna struktura, DI, dojrzały ekosystem; ten sam język co frontend |
| API | **REST (OpenAPI) + WebSocket** | REST dla operacji CRUD i integracji zewnętrznych; WS dla realtime zamówień |
| Baza danych | **PostgreSQL 16** | Relacyjny model zamówień/menu, transakcyjność płatności, Row-Level Security dla multi-tenancy |
| ORM | **Prisma** | Type-safe zapytania, migracje, dobra ergonomia w TS |
| Cache / pub-sub | **Redis** | Kolejka realtime (WS fan-out), cache menu, rate limiting, sesje gości |
| Storage plików | **S3 / Cloudflare R2 + CDN** | Zdjęcia dań, logotypy, wygenerowane PDF-y z kodami QR |
| Płatności gości | **Stripe (karty, Apple/Google Pay) + Przelewy24 lub Stripe BLIK** | BLIK niezbędny w PL; abstrakcja `PaymentProvider` pozwala wymienić dostawcę na innych rynkach |
| Subskrypcje | **PayU (płatności jednorazowe za okres)** | Wybrane 2026-08-26 zamiast Stripe Billing. PayU nie ma odpowiednika Billing: cykl rozliczeniowy, przedłużanie okresu i przypomnienia są po naszej stronie (§11a). W zamian daje BLIK, który w Polsce jest metodą dominującą |
| Auth (personel) | **JWT (access + refresh) / Auth.js** | Standardowe logowanie e-mail+hasło, później SSO dla Enterprise |
| Auth (gość) | **Anonimowa sesja podpisana tokenem** | Zero rejestracji — token sesji powiązany ze stolikiem, ważny czasowo |
| Aplikacje natywne (Faza 2) | **React Native (Expo)** | Współdzielenie logiki i typów z web; jeden zespół na iOS + Android |
| Hosting | **Vercel (frontendy) + Railway/Fly.io lub AWS ECS (backend)** | Szybkie wdrożenia, skalowanie horyzontalne backendu |
| Monitoring | **Sentry + OpenTelemetry + Grafana** | Śledzenie błędów krytycznej ścieżki płatności i realtime |

### Struktura monorepo

```
kelbroo/
├── apps/
│   ├── web-marketing/     # System 1 — landing, cennik, checkout abonamentu
│   ├── web-admin/         # System 2 — panel restauracji + KDS + panel kelnera
│   ├── web-guest/         # System 3 — PWA gościa (skan QR → zamówienie)
│   ├── mobile-guest/      # System 3 — React Native (Faza 2)
│   └── api/               # Backend NestJS
├── packages/
│   ├── ui/                # Współdzielone komponenty (design system)
│   ├── types/             # Współdzielone typy DTO / kontrakty API
│   ├── i18n/              # Słowniki tłumaczeń UI
│   └── config/            # ESLint, TS config, Tailwind preset
└── docs/                  # Ta dokumentacja
```

Narzędzie: **pnpm workspaces + Turborepo**.

## 3. Model wielodostępowości (multi-tenancy)

Model: **jedna baza danych, izolacja na poziomie wiersza**.

- Każda tabela z danymi klienta zawiera `organization_id`.
- PostgreSQL **Row-Level Security (RLS)** wymusza izolację na poziomie bazy — nawet błąd w kodzie aplikacji nie ujawni danych innego tenanta.
- Kontekst tenanta ustawiany per żądanie z tokenu JWT (`SET LOCAL app.current_organization_id`).
- Hierarchia: `Organization` (klient SaaS, płatnik) → `Restaurant` (lokal) → `Table`, `Menu`, `Order`, `StaffMember`.
- Plan Starter/Pro = 1 lokal; Enterprise = wiele lokali w jednej organizacji.

## 4. Model danych (kluczowe encje)

```
Organization
  id, name, nip, billing_email, stripe_customer_id, created_at

Subscription
  id, organization_id, plan (starter|pro|enterprise), status (trialing|active|past_due|canceled),
  stripe_subscription_id, current_period_end, table_limit, language_limit

Restaurant
  id, organization_id, name, slug, address, timezone, currency, default_locale,
  supported_locales[], logo_url, theme (kolory/branding), opening_hours,
  ordering_mode (prepaid|pay_at_table|guest_choice),
  require_staff_confirmation (bool),
  table_activation_required (bool),   # kelner musi otworzyć wizytę zanim gość zamówi
  tipping_enabled (bool), tip_presets[], min_order_cents,
  open_bill_limit_cents,              # próg rachunku bez płatności → wymusza potwierdzenie
  fiscalization_mode (none|pos_bridge|cloud_register),
  settings (JSON)

StaffMember
  id, organization_id, restaurant_id, email, password_hash, role (owner|manager|waiter|kitchen),
  name, is_active, last_login_at

Table
  id, restaurant_id, label ("Stolik 12"), zone ("Taras"), seats,
  qr_token (unikalny, niezgadywalny), qr_version, is_active

MenuCategory
  id, restaurant_id, sort_order, is_active, available_hours (np. tylko śniadania)
  translations: [{ locale, name, description }]

MenuItem
  id, restaurant_id, category_id, sku, price_cents, currency, vat_rate,
  image_url, is_available, sort_order, allergens[], dietary_tags[] (vege/vegan/gluten-free),
  calories, prep_time_minutes, is_featured
  translations: [{ locale, name, description }]

MenuItemModifierGroup      # np. "Wybierz dodatek", "Stopień wysmażenia"
  id, menu_item_id, min_select, max_select, is_required, sort_order
  translations: [{ locale, name }]

MenuItemModifier           # np. "Ser dodatkowy +5 zł"
  id, group_id, price_delta_cents, is_available, sort_order
  translations: [{ locale, name }]

TableSession                          # wizyta przy stoliku = jeden rachunek
  id, restaurant_id, table_id, session_number (dzienny, czytelny: "Stolik 12 / #3"),
  status (open|awaiting_settlement|settled|closed|abandoned),
  opened_at, opened_by (guest|staff), opened_by_staff_id,
  closed_at, closed_by_staff_id,
  split_mode (none|per_person|per_item|equal|groups),
  subtotal_cents, tip_cents, vat_cents, total_cents, paid_cents, currency,
  guest_count

GuestSession                          # jedno urządzenie gościa w ramach wizyty
  id, restaurant_id, table_id, table_session_id, participant_id, token, locale,
  created_at, expires_at, last_seen_at

TableParticipant                      # osoba przy stoliku (tożsamość na czas wizyty)
  id, table_session_id,
  display_name,                       # nick wybrany lub wylosowany, np. "Wesoły Borsuk"
  avatar_key, color,                  # z zamkniętego zestawu, bez uploadu
  is_host (bool),                     # pierwszy skanujący / domyślny płatnik
  created_by (guest|staff),           # kelner może dodać osobę bez telefonu
  created_by_staff_id,
  settlement_group_id,
  joined_at, left_at

SettlementGroup                       # jednostka rozliczeniowa w ramach wizyty
  id, table_session_id, label,        # "Anna + Marek", "Stół firmowy"
  status (open|awaiting_payment|paid|settled),
  subtotal_cents, tip_cents, total_cents,
  payer_participant_id,
  created_by (guest|staff), created_at

OrderItemShare                        # podział pozycji między uczestników
  id, order_item_id, participant_id,
  share_units,                        # udział w częściach, np. 1 z 3 przy dzielonej butelce
  amount_cents                        # wyliczona kwota po zaokrągleniu

OrderEvent                            # append-only historia zmian zamówienia
  id, order_id, order_item_id (nullable),
  type (created|item_added|item_removed|quantity_changed|modifier_changed
        |note_changed|item_reassigned|confirmed|rejected|status_changed
        |discount_applied|canceled),
  actor_type (guest|staff|system),
  actor_participant_id, actor_guest_session_id, actor_staff_id,
  before (JSON), after (JSON), reason,
  created_at

Order
  id, restaurant_id, table_id, table_session_id, guest_session_id,
  order_number (dzienny, czytelny),
  source (guest|staff),               # kto złożył zamówienie
  created_by_participant_id, created_by_staff_id,
  status (submitted|awaiting_confirmation|confirmed|preparing|ready|served|closed
          |rejected|canceled),
  payment_status (not_required|awaiting_payment|paid|awaiting_settlement|settled
          |failed|refunded),
  subtotal_cents, tip_cents, vat_cents, total_cents, currency,
  guest_note, created_at, confirmed_at, confirmed_by_staff_id,
  ready_at, served_at, rejected_reason

OrderItem
  id, order_id, menu_item_id, name_snapshot, quantity, unit_price_cents,
  modifiers_snapshot (JSON), item_note,
  status (queued|preparing|ready|served|canceled),
  for_participant_id,                 # dla kogo jest ta pozycja (podstawa podziału)
  is_shared (bool),                   # dzielona → rozbicie w OrderItemShare
  added_by (guest|staff),             # atrybucja: gość sam czy kelner
  added_by_participant_id, added_by_staff_id,
  last_edited_by (guest|staff), last_edited_by_staff_id, last_edited_at

Payment
  id, table_session_id, settlement_group_id (nullable), order_id (nullable),
  provider (stripe|przelewy24|offline),
  provider_payment_id,
  method (blik|card|apple_pay|google_pay|cash|card_terminal|voucher),
  status (pending|succeeded|failed|refunded),
  amount_cents, currency, paid_at, collected_by_staff_id,   # kto przyjął płatność offline
  receipt_url, fiscal_receipt_id

Review
  id, order_id, table_session_id, restaurant_id, menu_item_id (nullable = ocena ogólna wizyty),
  rating (1-5), comment, target (dish|kitchen|service|manager), is_read, created_at

WaiterCall
  id, restaurant_id, table_id, table_session_id, guest_session_id,
  reason (help|bill|water|other), status (open|acknowledged|resolved),
  created_at, acknowledged_by_staff_id, resolved_at

AuditLog
  id, organization_id, actor_staff_id, action, entity, entity_id, payload, created_at
```

**Uwagi projektowe:**

- `OrderItem` przechowuje *snapshot* nazwy, ceny i modyfikatorów w momencie zamówienia — późniejsza zmiana ceny w menu nie może zmienić historycznego rachunku.
- **`TableSession` jest jednostką rachunku, nie `Order`.** Gość w trakcie jednej wizyty składa wiele zamówień (przystawka, danie główne, deser) — wszystkie należą do tej samej wizyty i w trybie `pay_at_table` rozliczają się jednym rachunkiem. Kwoty na `TableSession` to suma zamówień o statusie innym niż `rejected`/`canceled`.
- **Wiele urządzeń, jeden rachunek:** kilka osób przy stoliku skanuje ten sam kod QR i dostaje osobne `GuestSession`, ale wspólną `TableSession`. To fundament pod podział rachunku w Fazie 2.
- **`status` i `payment_status` są rozdzielone.** Realizacja zamówienia i jego rozliczenie to dwa niezależne cykle życia — w trybie `pay_at_table` zamówienie jest `served`, gdy płatność wciąż jest `awaiting_settlement`. Sklejanie ich w jedno pole było błędem pierwszej wersji modelu.
- **Każda pozycja ma trzy niezależne atrybucje:** kto ją dodał (`added_by*` — gość czy kelner), dla kogo jest (`for_participant_id` — podstawa podziału rachunku) i kto ostatnio edytował (`last_edited_by*`). To trzy różne osoby w typowym scenariuszu: kelner dodaje deser dla gościa, potem manager koryguje ilość.
- **`OrderEvent` jest append-only i jest źródłem prawdy o historii zamówienia.** Pola `last_edited_by*` na `OrderItem` to wyłącznie denormalizacja pod szybkie wyświetlanie listy — nigdy nie nadpisujemy historii, tylko dopisujemy zdarzenia.
- **`TableParticipant` to tożsamość na czas jednej wizyty**, nie konto użytkownika. Nick i awatar z zamkniętego zestawu, bez uploadu i bez danych osobowych — uczestnik znika wraz z zamknięciem wizyty.

## 5. Model tłumaczeń (wielojęzyczność)

Dwa rozdzielne obszary:

1. **UI aplikacji** — pliki słowników w `packages/i18n` (klucz → tłumaczenie), ładowane per locale. Biblioteka: `next-intl`.
2. **Treść menu** — dane w bazie, tabela `*_translations` z kluczem `(entity_id, locale)`. Restauracja definiuje `default_locale` i `supported_locales[]`.

Zasady:
- Brak tłumaczenia dla danego locale → fallback na `default_locale` restauracji (nigdy pusty ekran).
- Wybór języka gościa: `?lang=` z QR → `Accept-Language` przeglądarki → `default_locale`; wybór zapisywany w sesji gościa.
- Faza 2: automatyczne tłumaczenie AI z obowiązkową akceptacją managera przed publikacją (kontrola jakości nazw dań).

## 6. Przepływ zamówienia (sequence)

### 6.1 Maszyna stanów zamówienia

Realizacja (`status`) i rozliczenie (`payment_status`) biegną równolegle. Bramka do kuchni jest jedna — `confirmed` — ale warunek jej przejścia zależy od trybu restauracji.

```
                         ┌──────────────┐
   gość składa zamówienie│  submitted   │
                         └──────┬───────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
   tryb prepaid:                    tryb pay_at_table:
   payment_status = awaiting_payment  payment_status = awaiting_settlement
              │                                   │
   webhook operatora → paid                       │
              │                                   │
              └─────────────────┬─────────────────┘
                                │
                  require_staff_confirmation ?
                     ┌──────────┴──────────┐
                 tak │                     │ nie
        ┌─────────────▼────────┐           │
        │ awaiting_confirmation│           │
        └──────┬──────────┬────┘           │
       kelner  │          │ kelner         │
      zatwierdza          odrzuca          │
               │          │                │
               │     ┌────▼─────┐          │
               │     │ rejected │          │
               │     └──────────┘          │
               └──────────┬────────────────┘
                          │
                   ╔══════▼══════╗
                   ║  confirmed  ║ ◄── BRAMKA: dopiero tu zamówienie widzi kuchnia
                   ╚══════┬══════╝
                          │  kuchnia rozpoczyna
                   ┌──────▼──────┐
                   │  preparing  │
                   └──────┬──────┘
                          │  kuchnia oznacza gotowe
                   ┌──────▼──────┐
                   │    ready    │
                   └──────┬──────┘
                          │  kelner wydaje do stolika
                   ┌──────▼──────┐
                   │   served    │
                   └──────┬──────┘
                          │  rachunek wizyty rozliczony
                   ┌──────▼──────┐
                   │   closed    │   payment_status = paid | settled
                   └─────────────┘
```

`canceled` jest osiągalny z `submitted`, `awaiting_confirmation` i `confirmed` (przed rozpoczęciem przygotowania); po `preparing` anulowanie wymaga uprawnień managera i pociąga zwrot lub korektę rachunku.

### 6.2 Tryb `prepaid` — płatność w aplikacji

```
Gość (PWA)          API              Redis/WS         Panel kuchni     Panel kelnera
   │                 │                  │                  │                │
   ├─ GET /t/{qr} ──►│                  │                  │                │
   │◄─ menu + sesja ─┤ (tworzy/dołącza do TableSession)     │                │
   │                 │                  │                  │                │
   ├─ POST /orders ─►│                  │                  │                │
   │                 ├─ Order: submitted / awaiting_payment │                │
   │◄─ payment intent┤                  │                  │                │
   │                 │                  │                  │                │
   ├─ płatność BLIK/karta (SDK dostawcy)│                  │                │
   │                 │◄─ webhook: paid ─┤                  │                │
   │                 ├─ confirmed ─────►│── push ─────────►│                │
   │◄── WS: potwierdzone                │   NOWE ZAMÓWIENIE│                │
   │                 │◄─ preparing ─────┼──────────────────┤                │
   │◄── WS: preparing┤                  │                  │                │
   │                 │◄─ ready ─────────┼──────────────────┤                │
   │◄── WS: gotowe ──┤                  │── push ──────────┼───────────────►│
   │                 │                  │                  │  DO WYDANIA    │
   │                 │◄─ served ────────┼──────────────────┼────────────────┤
   │◄── WS: wydane ──┤                  │                  │                │
   │                 │                  │                  │                │
   ├─ POST /reviews ►│  (po posiłku: ocena dań + feedback)  │                │
```

**Zasada:** w tym trybie zamówienie trafia do kuchni **wyłącznie po potwierdzeniu płatności webhookiem od operatora** — nigdy na podstawie odpowiedzi klienta, którą można sfałszować.

### 6.3 Tryb `pay_at_table` — płatność u kelnera po konsumpcji

```
Gość (PWA)          API              Redis/WS      Panel kelnera    Panel kuchni
   │                 │                  │                │                │
   ├─ GET /t/{qr} ──►│                  │                │                │
   │                 ├─ TableSession: open                │                │
   │◄─ menu + sesja ─┤  (jeśli table_activation_required: │                │
   │                 │   czeka aż kelner otworzy stolik)  │                │
   │                 │                  │                │                │
   ├─ POST /orders ─►│                  │                │                │
   │                 ├─ Order: awaiting_confirmation      │                │
   │                 │   payment_status: awaiting_settlement               │
   │                 ├─ push ──────────►│───────────────►│                │
   │◄── WS: czeka na potwierdzenia      │ DO POTWIERDZENIA               │
   │                 │                  │                │                │
   │                 │◄─ kelner potwierdza przy stoliku ──┤                │
   │                 ├─ confirmed ─────►│────────────────┼───────────────►│
   │◄── WS: przyjęte │                  │                │ NOWE ZAMÓWIENIE│
   │                 │◄─ preparing / ready ───────────────┼────────────────┤
   │◄── WS: gotowe ──┤                  │───────────────►│                │
   │                 │◄─ served ────────┼────────────────┤                │
   │                 │                  │                │                │
   ├─ (dozamawia: kolejne Order do tej samej TableSession)│                │
   │                 │                  │                │                │
   ├─ POST /calls ──►│  "poproszę rachunek"               │                │
   │                 ├─ push ──────────►│───────────────►│ RACHUNEK       │
   │                 │                  │                │                │
   │                 │◄─ kelner: settle (gotówka/terminal)┤                │
   │                 ├─ TableSession: settled → closed    │                │
   │                 │   Payment(provider=offline, collected_by_staff_id)  │
   │◄── WS: rachunek rozliczony         │                │                │
   │                 │                  │                │                │
   ├─ POST /reviews ►│  (ocena dań + feedback)            │                │
```

**Kluczowe różnice:**
- Aplikacja gościa **nie pokazuje żadnej ścieżki płatności** — brak koszyka z płatnością, brak napiwków online, brak pola na e-mail do paragonu. Przycisk finalizujący to „Zamawiam", nie „Zamawiam i płacę".
- Fiskalizacja odbywa się **poza kelbroo**, na istniejącej kasie restauracji. `Payment` zapisywany jest wyłącznie ewidencyjnie (`provider = offline`), do raportów i rozliczenia kelnera.
- Rachunek zamyka **wyłącznie personel** — gość nie może samodzielnie oznaczyć wizyty jako rozliczonej.

### 6.4 Zabezpieczenia trybu bez przedpłaty

Brak płatności z góry oznacza realne ryzyko fałszywych zamówień i strat. Warstwy obrony, konfigurowalne per restauracja:

| Mechanizm | Działanie |
|---|---|
| `require_staff_confirmation` | Zamówienie czeka na fizyczne potwierdzenie kelnera przy stoliku (domyślnie **włączone** w tym trybie) |
| `table_activation_required` | Gość nie może zamawiać, dopóki obsługa nie otworzy wizyty przy stoliku — skan QR pokazuje „Poproś obsługę o otwarcie stolika" |
| `open_bill_limit_cents` | Po przekroczeniu progu rachunku kolejne zamówienia zawsze wymagają potwierdzenia, nawet gdy potwierdzanie jest wyłączone |
| Rate limiting per `GuestSession` | Limit zamówień i pozycji w oknie czasowym |
| Wygaszanie porzuconych wizyt | `TableSession` bez aktywności przez X godzin → `abandoned`, alert dla managera (wykrywanie „wyjścia bez płacenia") |
| Audit log rozliczeń | Każde `settle` zapisane z `collected_by_staff_id` i metodą — podstawa rozliczenia kelnera na koniec zmiany |

## 7. Warstwa realtime

- **Transport:** WebSocket (Socket.IO lub natywny WS z NestJS Gateway), fallback na SSE.
- **Kanały (rooms):**
  - `restaurant:{id}:orders` — panel kuchni i kelnera (wszystkie zamówienia lokalu)
  - `order:{id}` — apka gościa (tylko własne zamówienie)
  - `restaurant:{id}:calls` — przywołania kelnera
- **Skalowanie:** Redis adapter dla pub/sub między instancjami backendu.
- **Odporność:** klient automatycznie się reconnectuje i przy połączeniu robi `GET /orders?since=` żeby nadrobić zdarzenia utracone offline (WS nie jest jedynym źródłem prawdy).
- **Fallback:** jeśli WS nie zestawi połączenia w 5s → polling co 10s (typowe dla słabego wi-fi w lokalach).

## 8. Bezpieczeństwo

- **Tokeny QR:** losowe, niezgadywalne (min. 128-bit), nie sekwencyjne ID stolika — zapobiega zamawianiu "na czyjś stolik" spoza lokalu. `qr_version` pozwala unieważnić stary wydruk (regeneracja QR).
- **Sesje gości:** anonimowe, krótkotrwałe (wygasają po X godzin bez aktywności lub po zamknięciu rachunku). Żadnych danych osobowych poza opcjonalnym e-mailem do paragonu.
- **Ochrona przed nadużyciem:** rate limiting per sesja/IP, opcjonalny wymóg obecności w lokalu (geofencing lub potwierdzenie kelnera dla dużych zamówień), limit wartości zamówienia bez płatności.
- **Płatności:** kelbroo nigdy nie dotyka danych karty — tokenizacja po stronie dostawcy (PCI DSS SAQ-A). Webhooki weryfikowane podpisem.
- **Personel:** hasła bcrypt/argon2, wymuszona zmiana przy pierwszym logowaniu, role RBAC (owner > manager > waiter/kitchen), audit log wrażliwych akcji (zmiana cen, anulowanie zamówienia, zwrot).
- **RODO:** minimalizacja danych, retencja zamówień zgodna z wymogami księgowymi, mechanizm usunięcia danych na żądanie, polityka prywatności w apce gościa.
- **Multi-tenancy:** RLS w Postgresie jako druga linia obrony poza filtrowaniem w aplikacji.

## 9. Środowiska i wdrożenia

| Środowisko | Cel | Dane |
|---|---|---|
| `local` | Rozwój (Docker Compose: Postgres + Redis) | Seed z demo-restauracją |
| `staging` | Testy integracyjne, demo dla klientów | Sandbox Stripe/P24 |
| `production` | Ruch produkcyjny | Klucze produkcyjne, backupy co 6h, PITR |

- CI/CD: GitHub Actions — lint, typecheck, testy, migracje Prisma, deploy per aplikacja (Turborepo affected).
- Migracje bazy: wersjonowane, wstecznie kompatybilne (expand/contract) — brak przestojów w godzinach pracy restauracji.

## 10. Strategia testów

- **Unit** — logika cenowa (VAT, modyfikatory, napiwki, rabaty), maszyna stanów zamówienia.
- **Integration** — endpointy API z testową bazą, webhooki płatności (symulowane zdarzenia dostawcy), izolacja RLS między tenantami.
- **E2E (Playwright)** — pełna ścieżka: skan QR → zamówienie → płatność sandbox → pojawienie się w KDS → wydanie → ocena.
- **Obciążeniowe** — scenariusz szczytu: 50 stolików składających zamówienia jednocześnie w jednym lokalu.
- **Manualne na urządzeniach** — iPad i tablet Android w panelu obsługi (dotyk, jasność, orientacja, praca ciągła przez całą zmianę).

## 11. Ryzyka techniczne

| Ryzyko | Wpływ | Mitygacja |
|---|---|---|
| Awaria wi-fi w restauracji | Personel traci dostęp do zamówień | Offline-first w panelu obsługi (kolejka akcji + IndexedDB), tryb awaryjny z drukarką |
| Awaria dostawcy płatności | Brak możliwości zamówienia | Fallback "zapłać u kelnera", drugi provider jako zapas |
| Gość skanuje QR spoza lokalu | Fałszywe zamówienia | Niezgadywalne tokeny, rate limit, opcjonalne potwierdzenie kelnera |
| Wymogi fiskalizacji w PL | Blokada wdrożenia produkcyjnego | Start w trybie `pay_at_table` (fiskalizacja poza systemem), decyzja o docelowej ścieżce wg §12 |
| Fałszywe zamówienia w trybie bez przedpłaty | Straty restauracji, utrata zaufania do produktu | Warstwy zabezpieczeń z §6.4, domyślnie włączone potwierdzanie przez obsługę |
| Rosnąca liczba lokali (skala) | Spadek wydajności realtime | Redis pub/sub, sharding kanałów per restauracja, monitoring od dnia 1 |

## 11a. Abonament i płatności za niego

Operator: **PayU**, płatności **jednorazowe za okres** (miesiąc albo rok).
Wybór z 2026-08-26; wcześniejsze wersje tego dokumentu zakładały Stripe Billing.

**Co PayU daje, a czego nie.** Daje przyjęcie pieniędzy wszystkimi metodami
używanymi w Polsce: BLIK, przelew, karta, Apple/Google Pay. Nie daje niczego
z tego, co Stripe nazywa Billing — nie ma cyklu rozliczeniowego, portalu klienta,
faktur, proracji ani ponawiania nieudanych obciążeń. **Silnik abonamentowy jest
nasz**, PayU jest wyłącznie kasą.

**Bramka jest jedna i jest nią powiadomienie.** Abonament przedłuża wyłącznie
podpisane powiadomienie od operatora (`POST /api/billing/notify`), nigdy powrót
przeglądarki na `continueUrl`. To ta sama zasada, która trzyma bramkę do kuchni
na webhooku płatności, a nie na odpowiedzi klienta. Powrót przeglądarki służy
jedynie do zapytania serwera, co wie.

**Podpis jest całym uwierzytelnieniem tego wejścia.** Adres jest publiczny, a treść
mówi, komu przedłużyć abonament — bez sprawdzenia podpisu wystarczyłby jeden `curl`,
żeby opłacić sobie rok. Podpis liczy się ze **surowych bajtów** żądania i drugiego
klucza (MD5 albo SHA-256, zależnie od konfiguracji POS-u), stąd `rawBody: true`
w `main.ts`.

**Powtórki są stanem normalnym.** Operator ponawia powiadomienie, dopóki nie
dostanie 200. Przetworzenie jest idempotentne: zamówienie już zaksięgowane nie
przedłuża abonamentu drugi raz.

**Kwoty.** Cennik podaje netto (odbiorcą jest firma), operator inkasuje brutto.
Przeliczenie żyje w `packages/types/src/plans.ts` i jest jedynym miejscem, w którym
dolicza się VAT. Kwoty zamrażane są w `SubscriptionOrder` w chwili zakupu — zmiana
cennika nie może przepisać historii, bo za tym wierszem stoi faktura.

**Okres to miesiąc kalendarzowy, nie 30 dni**, z przycięciem dnia do długości
krótszego miesiąca. Zakup przy trwającym abonamencie dolicza się do jego końca,
a nie od dziś.

**Odczyt w poprzek najemców.** Powiadomienie przychodzi bez sesji, więc jeden wąski
odczyt (`subscription_order` po `external_id`) idzie połączeniem katalogowym, żeby
ustalić najemcę; cała reszta pracy przez `withTenant`. To trzecia — po logowaniu do
zaplecza i liście klientów — świadomie wybrana droga omijająca RLS.

**Faktury VAT wystawiamy poza kelbroo** (decyzja 2026-08-26). Po zaksięgowanej
wpłacie na `kontakt@kelbroo.com` idzie wiadomość z kompletem danych nabywcy.
Integracja z systemem księgowym jest do zrobienia, gdy liczba klientów to uzasadni.

**Czego jeszcze nie ma:** automatycznego odnawiania (token karty), przypomnień przed
końcem okresu i ponawiania nieudanych płatności. Zakup jednorazowy jest warunkiem
koniecznym dla każdej z tych rzeczy, więc nic z tej pracy nie przepadnie.

## 12. Fiskalizacja i paragony (Polska)

> **Zastrzeżenie:** poniższe opcje to analiza techniczna, nie porada podatkowa. Wybór ścieżki wymaga potwierdzenia przez doradcę podatkowego przed wdrożeniem produkcyjnym z płatnościami online.

Obowiązek fiskalny dotyczy sprzedaży na rzecz osób fizycznych. Kluczowe pytanie architektoniczne brzmi: **czy kelbroo staje się miejscem, w którym dochodzi do sprzedaży**, czy pozostaje wyłącznie kanałem przyjmowania zamówień.

Restauracja wybiera tryb w polu `Restaurant.fiscalization_mode`.

### Opcja A — `none`: fiskalizacja poza kelbroo (tryb `pay_at_table`)

Gość zamawia przez aplikację, ale płaci kelnerowi po konsumpcji. Płatność jest przyjmowana i fiskalizowana na **istniejącej kasie fiskalnej restauracji**, dokładnie jak przy zamówieniu ustnym. kelbroo rejestruje płatność wyłącznie ewidencyjnie (`Payment.provider = offline`), na potrzeby raportów i rozliczenia kelnera.

| | |
|---|---|
| **Zalety** | Zero wymogów fiskalnych po stronie kelbroo. Zero integracji sprzętowych. Restauracja nie zmienia obiegu płatności ani procedur księgowych. **Najkrótsza droga do pierwszego wdrożenia produkcyjnego.** |
| **Wady** | Brak płatności online, więc brak napiwków cyfrowych i brak zabezpieczenia przed wyjściem bez płacenia. Kelner nadal musi podejść i rozliczyć. |
| **Nakład** | Brak — dostępne w MVP etap 1. |
| **Dla kogo** | Restauracje z pełną obsługą kelnerską; wszystkie lokale w fazie pilotażu. |

### Opcja B — `pos_bridge`: integracja z kasą/drukarką fiskalną restauracji

kelbroo wysyła paragon do urządzenia fiskalnego stojącego w lokalu. Ponieważ drukarki fiskalne komunikują się lokalnie (RS-232 / USB / TCP w sieci lokalnej), a kelbroo działa w chmurze, potrzebny jest **kelbroo Bridge** — mała aplikacja uruchomiona na komputerze lub Raspberry Pi w restauracji.

```
Chmura kelbroo ──WebSocket (wychodzące)──► kelbroo Bridge (lokalnie w restauracji)
                                                │
                                                ├── RS-232/USB ──► drukarka fiskalna
                                                └── TCP/API ─────► kasa lub system POS
```

- Bridge inicjuje połączenie **wychodzące** — nie wymaga otwierania portów ani stałego IP w restauracji.
- Kolejkuje paragony lokalnie przy braku internetu i wysyła po odzyskaniu połączenia.
- Docelowe protokoły: **Posnet, Elzab, Novitus** (drukarki online) oraz API popularnych systemów POS gastronomicznych.

| | |
|---|---|
| **Zalety** | Restauracja używa sprzętu, który już ma i który jest już zgłoszony w urzędzie. Naturalna ścieżka do pełnej integracji z POS (jedno źródło raportów sprzedaży). |
| **Wady** | Fragmentacja sprzętu — każdy producent to osobna implementacja i osobne testy. Bridge to dodatkowy element, który może paść i wymaga wsparcia technicznego. Wydłuża onboarding z godzin do dni. |
| **Nakład** | Wysoki: ~2–3 miesiące na pierwszego producenta, potem ~2–3 tygodnie na kolejnego. |
| **Dla kogo** | Plan Pro (dodatek 149 zł/mies) i Enterprise. Lokale z istniejącym POS-em, sieci. |

### Opcja C — `cloud_register`: własne API fiskalizacji (kasa wirtualna)

kelbroo fiskalizuje sprzedaż samodzielnie, przez **kasę wirtualną** (oprogramowanie zamiast urządzenia) lub przez integrację z certyfikowanym dostawcą fiskalizacji jako usługi. Gość dostaje **e-paragon** na wskazany adres e-mail; nie ma żadnego sprzętu po stronie restauracji.

Usługi gastronomiczne należą do kategorii, dla których polskie przepisy dopuszczają kasy wirtualne — **ten punkt wymaga jednak formalnego potwierdzenia i weryfikacji aktualnego stanu prawnego przed rozpoczęciem prac.**

| | |
|---|---|
| **Zalety** | Zero sprzętu i zero instalacji w lokalu — onboarding pozostaje w pełni samoobsługowy. E-paragon zamiast wydruku (niższy koszt, argument ekologiczny). Pełna kontrola nad doświadczeniem gościa i jedno źródło danych sprzedażowych. |
| **Wady** | Wymogi certyfikacyjne i homologacyjne, odpowiedzialność prawna po stronie kelbroo, cykliczny koszt dostawcy. Najwyższe ryzyko regulacyjne. |
| **Nakład** | Wysoki: ~3–4 miesiące, w tym analiza prawna i wybór dostawcy. |
| **Dla kogo** | Plan Pro i Enterprise (dodatek 99 zł/mies + opłaty operatora). Docelowa opcja dla nowych lokali bez własnej kasy. |

### Rekomendacja wdrożeniowa

1. **Etap 1 (MVP):** wyłącznie opcja A. Pozwala wdrożyć produkt u pilotażowych klientów bez rozstrzygania kwestii fiskalnych i bez integracji płatniczej.
2. **Etap 2:** płatności online + opcja B dla lokali, które mają już kasę lub POS — mniejsze ryzyko regulacyjne niż opcja C, bo obowiązek fiskalny zostaje po stronie restauracji.
3. **Etap 3:** opcja C jako produkt docelowy, po walidacji prawnej i przy odpowiedniej skali uzasadniającej koszt certyfikacji.

Warstwa `FiscalizationProvider` w backendzie ma być **abstrakcją od pierwszej linii kodu** — nawet jeśli w etapie 1 istnieje wyłącznie implementacja `NoopFiscalizationProvider`. Dopisanie opcji B i C nie może wtedy wymagać zmian w logice zamówień.

## 13. Atrybucja i edycja zamówień

Zamówienie przy stoliku nie jest tworzone wyłącznie przez gościa. Kelner musi móc złożyć zamówienie w czyimś imieniu (gość woli zamówić ustnie, nie ma telefonu, nie radzi sobie z aplikacją) oraz poprawić zamówienie już złożone (gość pomylił pozycję, kuchnia zgłasza brak składnika, korekta po rozmowie przy stoliku).

Wymóg nadrzędny: **w każdym momencie musi być jednoznacznie widoczne, co dodał gość, a co obsługa.** To podstawa rozliczenia kelnera, rozstrzygania sporów o rachunek i wykrywania nadużyć.

### 13.1 Trzy niezależne atrybucje

Każda pozycja zamówienia niesie trzy różne odpowiedzi, których nie wolno mylić:

| Pole | Pytanie | Przykład |
|---|---|---|
| `added_by` + `added_by_participant_id` / `added_by_staff_id` | **Kto to wprowadził?** | Kelner Anna |
| `for_participant_id` | **Dla kogo to jest?** | Uczestnik „Wesoły Borsuk" |
| `last_edited_by*` | **Kto ostatnio zmienił?** | Manager Piotr |

W typowym scenariuszu to trzy różne osoby. Sprowadzenie ich do jednego pola „kto dodał" uniemożliwia zarówno podział rachunku, jak i audyt korekt.

### 13.2 Historia zmian (`OrderEvent`)

Append-only strumień zdarzeń, nigdy nadpisywany. Każde zdarzenie zapisuje `actor_type` (`guest` / `staff` / `system`), identyfikator aktora, stan `before` i `after` oraz opcjonalny powód.

Rejestrowane zdarzenia: utworzenie zamówienia, dodanie i usunięcie pozycji, zmiana ilości, zmiana modyfikatorów, zmiana uwagi, przepisanie pozycji na innego uczestnika, potwierdzenie, odrzucenie, zmiana statusu, rabat, anulowanie.

Odbiorcy historii:
- **Manager** — pełna oś czasu w szczegółach zamówienia, z nazwiskami pracowników.
- **Kelner** — skrócona historia bieżącej wizyty (kto co dodał), bez danych innych pracowników.
- **Gość** — wyłącznie informacja, że pozycja została dodana lub zmieniona przez obsługę (bez nazwiska). Gość musi widzieć, że coś na jego rachunku pojawiło się nie z jego ręki — inaczej rachunek przestaje być weryfikowalny.

### 13.3 Kto i kiedy może edytować

| Stan zamówienia | Gość (autor) | Inny uczestnik | Kelner | Manager |
|---|---|---|---|---|
| `submitted` / `awaiting_confirmation` | ✅ pełna edycja | ❌ | ✅ pełna edycja | ✅ |
| `confirmed` | ❌ | ❌ | ✅ dodawanie pozycji, usuwanie tylko przed startem kuchni | ✅ |
| `preparing` | ❌ | ❌ | ✅ tylko dodawanie nowych pozycji | ✅ z powodem |
| `ready` / `served` | ❌ | ❌ | ❌ | ✅ tylko korekta rachunku, z powodem |
| `closed` | ❌ | ❌ | ❌ | ❌ (wyłącznie storno + korekta) |

Zasady dodatkowe:
- Gość edytuje **wyłącznie własne pozycje** — nie może zmienić tego, co zamówił ktoś inny przy stoliku.
- Usunięcie pozycji będącej już w przygotowaniu zawsze wymaga powodu i trafia do `AuditLog` (strata produktu).
- Każda edycja przez obsługę po `confirmed` wywołuje ponowne przeliczenie rachunku i powiadomienie na urządzeniu gościa („Kelner dodał do Twojego zamówienia: Tiramisu").
- Edycja jest operacją na zamówieniu, nie na wizycie — nowe pozycje dodane przez kelnera po `preparing` mogą trafić do **nowego** zamówienia w tej samej wizycie, jeśli kuchnia już drukuje bieżące. Decyzja konfiguracyjna: `append_to_order` vs `create_follow_up_order`.

### 13.4 Zamówienie składane przez kelnera

- `Order.source = staff`, `created_by_staff_id` wypełnione.
- Kelner wybiera stolik, a następnie **uczestnika**, dla którego zamawia — albo dodaje nowego uczestnika bez telefonu (`TableParticipant.created_by = staff`). Bez tego kroku podział rachunku dla gości bez aplikacji jest niemożliwy.
- Zamówienie od obsługi pomija kolejkę `awaiting_confirmation` — kelner stoi przy stoliku i już je potwierdził.
- W trybie `prepaid` zamówienie kelnerskie domyślnie trafia na rachunek stolika do rozliczenia u obsługi (gość nie ma jak zapłacić w aplikacji za coś, czego nie dodał).

## 14. Podział rachunku

Podział rachunku jest funkcją **wizyty** (`TableSession`), nie pojedynczego zamówienia. Model opiera się na dwóch encjach: `TableParticipant` (kto siedzi przy stoliku) i `SettlementGroup` (kto z kim się rozlicza).

### 14.1 Tożsamość uczestnika

Każda osoba skanująca kod QR przy tym samym stoliku dołącza do tej samej wizyty jako osobny `TableParticipant`:

- **Nick** — gość wpisuje własny lub losuje z generatora (np. „Wesoły Borsuk", „Szybki Jeż"). Losowanie jest ścieżką domyślną: jedno kliknięcie, zero wpisywania, zero danych osobowych.
- **Awatar** — wybór z zamkniętego zestawu ilustracji + kolor. Brak uploadu zdjęć: eliminuje moderację treści i przetwarzanie wizerunku.
- **Brak konta.** Tożsamość żyje wyłącznie w ramach wizyty i znika po jej zamknięciu. Nick i awatar nie są danymi osobowymi w rozumieniu RODO, o ile generator nie proponuje imion.
- **Walidacja nicku** — filtr wulgaryzmów i limit długości; nick jest widoczny dla innych gości przy stoliku i dla obsługi.
- Pierwszy skanujący zostaje `is_host` — domyślnym płatnikiem w scenariuszu „jedna osoba płaci za wszystkich".
- Kelner może dodać uczestnika **bez telefonu** (`created_by = staff`), aby przypisać mu pozycje i uwzględnić go w podziale.

### 14.2 Tryby podziału (`TableSession.split_mode`)

| Tryb | Jak dzieli | Zastosowanie |
|---|---|---|
| `none` | Jeden wspólny rachunek, jedna płatność | Domyślny; para, rodzina |
| `per_person` | Każdy uczestnik płaci za pozycje przypisane do siebie (`for_participant_id`) | Znajomi, lunch w pracy — **domyślny i jedyny tryb w `prepaid`** |
| `per_item` | Pozycje przypisywane ręcznie do osób, z możliwością dzielenia jednej pozycji między kilka osób (`OrderItemShare`) | Wspólna butelka wina, przystawki na środek stołu |
| `equal` | Suma dzielona równo przez liczbę uczestników | Szybkie rozliczenie bez liczenia kto co jadł |
| `groups` | Uczestnicy grupowani w `SettlementGroup`, każda grupa płaci osobno | Dwie pary, dwie firmy, stół firmowy + goście prywatni |

Zmiana trybu podziału jest możliwa **do momentu pierwszej płatności** w ramach wizyty. Po pierwszym rozliczeniu tryb jest zablokowany — inaczej kwoty już pobrane przestają się zgadzać z podziałem.

### 14.3 Podział a tryb zamawiania

| | `prepaid` | `pay_at_table` | `guest_choice` |
|---|---|---|---|
| `none` (jeden rachunek) | tylko gdy jedna osoba zamawia za wszystkich | ✅ | ✅ |
| `per_person` | ✅ **domyślny** — każdy płaci za własne zamówienie przy jego składaniu | ✅ | ✅ |
| `per_item` (dzielone pozycje) | ⚠️ tylko w obrębie własnego zamówienia | ✅ | ✅ |
| `equal` | ❌ nie ma czego dzielić — płatność już nastąpiła | ✅ | ⚠️ tylko część nieopłacona |
| `groups` | ❌ | ✅ | ⚠️ tylko część nieopłacona |

**W trybie `prepaid` podział jest naturalny i domyślny: każdy uczestnik składa i opłaca własne zamówienie ze swojego telefonu.** Nie trzeba niczego dzielić po fakcie — pozycje są już przypisane do płatnika. Wspólną pozycję (butelka wina) opłaca ten, kto ją zamówił; opcjonalne wyrównanie między gośćmi pozostaje poza systemem.

Zaawansowane tryby (`per_item`, `equal`, `groups`) mają sens wyłącznie tam, gdzie rachunek jest rozliczany na końcu wizyty — czyli w `pay_at_table` i w nieopłaconej części `guest_choice`.

### 14.4 Scenariusz „jedna osoba płaci za wszystkich"

Częsty przy kolacjach służbowych i spotkaniach rodzinnych: płaci jedna osoba, ale potrzebne jest zestawienie, kto co zamówił (rozliczenie delegacji, zwrot kosztów między znajomymi).

- Wszyscy uczestnicy trafiają do jednej `SettlementGroup`, `payer_participant_id` = host.
- Host płaci całość — w aplikacji (`prepaid`) lub u kelnera (`pay_at_table`).
- Po rozliczeniu dostępna akcja **„Wyślij zestawienie na e-mail"**: dokument z rozbiciem na uczestników — awatar, nick, jego pozycje, suma częściowa, plus suma całkowita.
- E-mail podawany **doraźnie, wyłącznie do wysyłki**, bez zakładania konta; nie jest zapisywany na stałe ani używany marketingowo (patrz [03-customer-ordering.md §4](03-customer-ordering.md#4-sesja-gościa-i-prywatność)).
- Każdy uczestnik może wysłać sobie **własne** zestawienie na swój e-mail, niezależnie od hosta.
- Dokument jest zestawieniem informacyjnym, **nie paragonem fiskalnym** — musi to być na nim wprost napisane.

### 14.5 Arytmetyka podziału

Podział rachunku, który nie sumuje się do kwoty całkowitej, to klasyczny i kompromitujący błąd. Reguły są wiążące:

- Wszystkie obliczenia na liczbach całkowitych w groszach (`*_cents`), nigdy na liczbach zmiennoprzecinkowych.
- Dzielenie pozycji: kwota rozdzielana metodą **największych reszt** (largest remainder), deterministycznie posortowaną po `participant_id`.
- Nierozdzielone grosze trafiają do uczestnika oznaczonego `is_host`.
- **Niezmiennik weryfikowany testem:** suma `amount_cents` wszystkich `OrderItemShare` danej pozycji równa się dokładnie `quantity × unit_price_cents` tej pozycji; suma wszystkich `SettlementGroup.total_cents` równa się `TableSession.total_cents`.
- VAT liczony od kwoty całkowitej pozycji i rozdzielany tą samą metodą — nigdy liczony osobno od zaokrąglonych części.
- Napiwek w podziale: dzielony proporcjonalnie do sumy częściowej albo ustalany indywidualnie przez każdego płatnika (ustawienie restauracji).
- Pozycje nieprzypisane do nikogo (`for_participant_id = null`) w trybie `per_item` blokują rozliczenie — panel kelnera i aplikacja gościa muszą to sygnalizować, zamiast po cichu doliczać je hostowi.

### 14.6 Płatności częściowe

- Wizyta może mieć **wiele rekordów `Payment`**, każdy powiązany z `SettlementGroup`.
- `TableSession.paid_cents` to suma udanych płatności; wizyta przechodzi w `settled` dopiero gdy `paid_cents >= total_cents`.
- Dozamówienie po częściowym rozliczeniu: nowe pozycje trafiają do grupy uczestnika, który je zamówił, i wymagają dopłaty — panel kelnera pokazuje pozostałą kwotę do rozliczenia.
- Kelner widzi w każdym momencie: kto już zapłacił, kto nie, ile brakuje.
- Blokada zamknięcia wizyty przy niepełnym rozliczeniu — zamknięcie z niedopłatą wymaga uprawnień managera i powodu (trafia do `AuditLog` jako strata).
