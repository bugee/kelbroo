# kelbroo

Platforma SaaS dla restauracji: gość skanuje kod QR przy stoliku, zamawia z telefonu,
zamówienie trafia do panelu kuchni i kelnera. **Self-service dining.**

Dokumentacja produktowa i techniczna: [docs/](docs/) — zacznij od
[docs/product.md](docs/product.md) i [docs/architecture.md](docs/architecture.md).
Zasady pracy nad kodem: [CLAUDE.md](CLAUDE.md).

## Wymagania

| Narzędzie | Wersja | Uwagi |
|---|---|---|
| Node.js | 22+ (zalecane 24) | wersja w `.nvmrc` |
| pnpm | 9.15+ | `corepack enable` |
| Docker | dowolna aktualna | Postgres 16 + Redis 7 lokalnie |

## Uruchomienie środowiska lokalnego

```bash
corepack enable
pnpm install
cp .env.example .env

pnpm infra:up          # Postgres + Redis w Dockerze
pnpm db:migrate        # migracje Prismy (schemat + RLS)
pnpm db:seed           # demo-restauracja z menu i kodami QR

pnpm --filter @kelbroo/api dev
curl http://localhost:4000/api/health
```

`pnpm db:seed` wypisuje dane logowania do panelu i tokeny QR stolików.
Aplikacja gościa stoi na `http://localhost:3001/t/{qrToken}`:

```bash
pnpm --filter @kelbroo/web-guest dev
```

### Testowanie z telefonu w sieci lokalnej

`localhost` z telefonu nie prowadzi do Twojego Maca, więc sam adres nie
wystarczy — trzeba przestawić dwie rzeczy na adres LAN (`ipconfig getifaddr en0`):

```bash
# .env — API musi wpuścić origin, z którego przyjdzie żądanie
CORS_ORIGINS="http://localhost:3001,http://192.168.0.10:3001"

# aplikacja gościa musi wołać API po tym samym adresie
NEXT_PUBLIC_API_URL="http://192.168.0.10:4000/api" pnpm --filter @kelbroo/web-guest dev
```

Potem otwórz na telefonie `http://192.168.0.10:3001/t/{qrToken}`.

### Panel obsługi

```bash
pnpm --filter @kelbroo/web-admin dev   # http://localhost:3002
```

Konta z seeda mają hasło `kelbroo123`: `owner@`, `manager@`, `kelner@`
i `kuchnia@demo.kelbroo.pl`. Rola decyduje o widocznych ekranach — kuchnia
nie widzi kolejki potwierdzeń ani rachunków.

## Struktura

```
apps/
  api/                 # NestJS + Prisma + PostgreSQL (backend wszystkich systemów)
  web-marketing/       # System 1 — landing i zakup abonamentu       [do zbudowania]
  web-admin/           # System 2 — kolejka kelnera, KDS, widok sali
  web-guest/           # System 3 — PWA gościa
packages/
  config/              # wspólne tsconfig + tokeny motywu (Tailwind v4)
  ui/                  # komponenty współdzielone (przełącznik palety)
  types/               # kontrakty domenowe i arytmetyka podziału rachunku
docker/postgres/       # bootstrap roli aplikacyjnej dla RLS
design/                # źródło prawdy dla palety i typografii
```

## Dwie rzeczy, o które łatwo się potknąć

**Rola aplikacyjna podlega RLS.** `DATABASE_URL` wskazuje na `kelbroo_app` —
tę rolę wiąże Row-Level Security i **bez ustawionego kontekstu tenanta nie
zobaczy ani jednego wiersza**. Każdy dostęp do danych klienta prowadzi przez
`PrismaService.withTenant(organizationId, …)`. `DIRECT_DATABASE_URL` to
superuser wyłącznie do migracji i seeda.

**Testy `@kelbroo/api` wymagają działającej bazy.** Zestaw RLS w
`apps/api/test/rls.spec.ts` sprawdza izolację tenantów na prawdziwym Postgresie
— bez `pnpm infra:up && pnpm db:migrate` po prostu się nie uruchomi.

**Kwoty tylko w groszach.** Nigdy `float`, nigdy dzielenie kwoty poza
`packages/types/src/money.ts`. Podział rachunku, który nie sumuje się do kwoty
całkowitej, jest błędem krytycznym — niezmiennik jest pokryty testem.

## Polecenia

| Polecenie | Działanie |
|---|---|
| `pnpm dev` | wszystkie aplikacje w trybie deweloperskim (Turborepo) |
| `pnpm build` / `pnpm typecheck` / `pnpm test` | build, typy, testy w całym monorepo |
| `pnpm infra:up` / `pnpm infra:down` | Postgres i Redis w Dockerze |
| `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:studio` | migracje, seed, przeglądarka bazy |
| `pnpm --filter @kelbroo/api db:reset` | czysta baza od zera |
