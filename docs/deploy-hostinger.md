# Wdrożenie kelbroo na Hostingerze — krok po kroku

Instrukcja dla **VPS w Hostingerze**. Zwykły hosting współdzielony ani „Cloud hosting"
**nie zadziała** — kelbroo potrzebuje Dockera, a ten jest dostępny wyłącznie na VPS.

Efekt końcowy: trzy działające adresy z certyfikatem HTTPS —
`kelbroo.com` (strona produktowa), `menu.kelbroo.com` (aplikacja gościa, do kodów QR)
i `panel.kelbroo.com` (panel obsługi: kuchnia, kelner, menu, stoliki).

Czas: **około 1 godziny**, z czego 20 minut to czekanie na instalację systemu i budowanie obrazów.

> **Co dostajesz w tym wydaniu:** MVP etap 1 — tryb `pay_at_table`.
> Gość zamawia z telefonu, płaci u kelnera. Płatności online i fiskalizacji jeszcze nie ma.

---

## Zanim zaczniesz — przygotuj dwie rzeczy

1. **Domenę `kelbroo.com`** — kupioną w Hostingerze albo gdziekolwiek indziej.
   Wszystko stoi na jednym serwerze, rozdzielone nazwą hosta: apex na stronę produktową,
   `menu.` na aplikację gościa, `panel.` na panel obsługi.
2. **Kartę płatniczą** do zakupu VPS-a (od ok. 9 USD/mies.).

Instrukcja używa `kelbroo.com`, bo to domena produkcyjna projektu. Wdrażając pod inną
domenę, podmień ją wszędzie — poza tym nic się nie zmienia.

---

## Krok 1. Kup VPS

1. Wejdź na [hostinger.com](https://www.hostinger.com) i zaloguj się (albo załóż konto).
2. Z górnego menu wybierz **VPS** → **VPS Hosting**.
3. Wybierz plan **KVM 2** (2 rdzenie, 8 GB RAM, 100 GB NVMe).
   - KVM 1 (1 rdzeń, 4 GB RAM) też uciągnie kelbroo, ale **budowanie aplikacji będzie na
     granicy pamięci** — jeśli wybierzesz KVM 1, zrób dodatkowo [krok 5b](#krok-5b-tylko-kvm-1--dodaj-swap).
4. Wybierz okres rozliczeniowy i zapłać.
5. Lokalizacja serwera: **Litwa / Niemcy / Holandia** — najbliżej Polski, najniższe opóźnienia.

---

## Krok 2. Zainstaluj system z Dockerem

Po zakupie Hostinger uruchomi kreator konfiguracji. Jeśli go zamkniesz, wszystko zrobisz ręcznie:

1. Wejdź do **hPanel** → z górnego menu **VPS**.
2. Kliknij **Manage** (Zarządzaj) przy swoim serwerze.
3. W lewym menu wybierz **OS & Panel** → **Operating System**.
4. Zjedź do sekcji **Change OS**.
5. W polu wyszukiwania wpisz **`Docker`**.
6. Wybierz szablon **Ubuntu 24.04 with Docker** i kliknij **Change OS** / **Install**.
7. Potwierdź. **Instalacja trwa ok. 10 minut.** Ekran możesz zamknąć.
8. Po instalacji Hostinger pokaże **hasło roota** — **zapisz je**.
   Zapisz też **adres IP serwera** (widoczny na stronie **Overview**, np. `31.220.101.55`).

> Ten szablon ma już zainstalowane `docker` i `docker compose`. Nie musisz nic instalować ręcznie.

---

## Krok 3. Skieruj domeny na serwer

Potrzebujesz **czterech rekordów A**, wszystkie wskazujące na to samo IP serwera:

| Type | Name | Points to | Co obsłuży |
|---|---|---|---|
| `A` | `@` | IP serwera | `kelbroo.com` — strona produktowa |
| `A` | `www` | IP serwera | przekierowanie na apex |
| `A` | `menu` | IP serwera | aplikacja gościa |
| `A` | `panel` | IP serwera | panel obsługi |

W polu **Name** wpisujesz **samo słowo** — `menu`, nie `menu.kelbroo.com`.
`@` oznacza samą domenę, bez subdomeny.

### Jeśli domena jest w Hostingerze

1. W **hPanel** wybierz z górnego menu **Domains**.
2. Kliknij swoją domenę.
3. W lewym menu kliknij **DNS / Nameservers**.
4. Zjedź do sekcji **Manage DNS records**.
5. Dodaj kolejno **cztery** rekordy z tabeli powyżej. Dla każdego:
   **Type** `A`, **Name** z tabeli, **Points to** IP serwera, **TTL** `14400`,
   potem **Add Record**.
6. Jeśli w liście jest już rekord `A` dla `@` albo `www` wskazujący gdzie indziej
   (parking domeny, stara strona) — **usuń go**, inaczej będą dwa sprzeczne wpisy.

### Jeśli domena jest u innego operatora

Wejdź w panel DNS swojego operatora i dodaj te same dwa rekordy A
(`menu` → IP, `panel` → IP).

### Sprawdź, czy zadziałało

Poczekaj 5–15 minut, potem na swoim komputerze (Terminal / PowerShell):

```bash
nslookup kelbroo.com
nslookup www.kelbroo.com
nslookup menu.kelbroo.com
nslookup panel.kelbroo.com
```

Wszystkie cztery muszą pokazać **IP twojego serwera**.

> ⚠️ **To jest warunek konieczny przed krokiem 7.** Certyfikat HTTPS jest pobierany
> automatycznie z Let's Encrypt przy pierwszym uruchomieniu, a Let's Encrypt sprawdza
> DNS. Jeśli uruchomisz aplikację przed propagacją DNS, certyfikat się nie wystawi.

---

## Krok 4. Otwórz porty 80 i 443

Domyślnie firewall Hostingera jest wyłączony i wszystko jest otwarte — wtedy ten krok
możesz pominąć. Jeśli chcesz go włączyć (zalecane), zrób tak:

1. **hPanel** → **VPS** → twój serwer.
2. W lewym menu: **Security** → **Firewall**.
3. Kliknij **Add Firewall**, wpisz nazwę (np. `kelbroo`), kliknij **Create**.
4. Przy nowo utworzonej grupie kliknij **⋯** → **Edit**.
5. W sekcji **Add firewall rule** dodaj kolejno **trzy** reguły (Action: **Accept**):

   | Protocol | Port | Po co |
   |---|---|---|
   | TCP | `22` | SSH — **bez tego stracisz dostęp do serwera** |
   | TCP | `80` | HTTP (przekierowanie na HTTPS + weryfikacja certyfikatu) |
   | TCP | `443` | HTTPS — właściwy ruch |

6. Przypisz firewall do swojego VPS-a (przycisk **Activate** / lista serwerów).

> Bazy danych i Redisa **nie otwierasz** — w konfiguracji produkcyjnej nie są w ogóle
> wystawione na świat, rozmawiają tylko wewnątrz Dockera.

---

## Krok 5. Zaloguj się na serwer

Najprościej **z przeglądarki**, bez żadnego programu:

1. **hPanel** → **VPS** → twój serwer → **Overview**.
2. Kliknij **Browser terminal**. Otworzy się czarne okno terminala — jesteś zalogowany jako `root`.

Alternatywnie z własnego komputera (Terminal na macOS/Linux, PowerShell na Windows):

```bash
ssh root@31.220.101.55
```

(podstaw swoje IP; hasło to zapisane wcześniej hasło roota)

Sprawdź, że Docker działa:

```bash
docker --version
docker compose version
```

Obie komendy muszą wypisać numer wersji.

### Krok 5b (tylko KVM 1) — dodaj swap

Jeśli kupiłeś **KVM 1** (4 GB RAM), dodaj 4 GB pliku wymiany, żeby budowanie aplikacji się nie wywaliło:

```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## Krok 6. Pobierz kod aplikacji

W terminalu serwera:

```bash
apt update && apt install -y git
cd /root
git clone https://github.com/bugee/kelbroo.git
cd kelbroo
```

Od tej pory **wszystkie komendy wykonujesz w katalogu `/root/kelbroo`.**
Jeśli się zgubisz, wróć komendą `cd /root/kelbroo`.

---

## Krok 7. Utwórz plik z hasłami

Aplikacja potrzebuje pliku `.env.prod` z domenami i sekretami.
**Skopiuj poniższy blok w całości**, ale najpierw podmień trzy pierwsze linie na swoje dane:

```bash
cat > .env.prod <<EOF
LANDING_DOMAIN=kelbroo.com
GUEST_DOMAIN=menu.kelbroo.com
ADMIN_DOMAIN=panel.kelbroo.com
ACME_EMAIL=kontakt@kelbroo.com

POSTGRES_PASSWORD=$(openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | cut -c1-32)
APP_DB_PASSWORD=$(openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | cut -c1-32)
REDIS_PASSWORD=$(openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | cut -c1-32)

JWT_ACCESS_SECRET=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-48)
GUEST_SESSION_SECRET=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-48)
EOF
chmod 600 .env.prod
cat .env.prod
```

Ostatnia linia wyświetli gotowy plik — **sześć haseł zostało wylosowanych automatycznie**,
nie musisz ich wymyślać ani zapamiętywać.

Sprawdź, czy w pierwszych czterech liniach są twoje domeny i twój e-mail. Jeśli nie —
popraw edytorem: `nano .env.prod` (zapis: `Ctrl+O`, `Enter`, wyjście: `Ctrl+X`).

> `LANDING_DOMAIN` możesz zostawić puste, jeśli wdrażasz sam panel i aplikację gościa —
> Caddy podstawi wtedy adres nierozwiązywalny i po prostu nie obsłuży strony produktowej.

> **Nigdy nie wrzucaj `.env.prod` do gita ani nikomu nie wysyłaj.** To hasła do bazy
> i klucze podpisujące sesje. Plik jest już wpisany w `.gitignore`.
>
> Hasła są celowo bez znaków specjalnych — trafiają do adresów połączeń z bazą,
> gdzie `/`, `+` czy `@` rozbiłyby adres.

---

## Krok 8. Uruchom aplikację

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

**`--env-file .env.prod` nie jest ozdobnikiem.** Docker Compose sam z siebie czyta
plik `.env`, a nasze hasła leżą w `.env.prod` — bez tej flagi **wszystkie zmienne
są puste**. Objawia się to tak:

```
WARN[0000] The "POSTGRES_PASSWORD" variable is not set. Defaulting to a blank string.
...
service "migrate" didn't complete successfully: exit 1
```

Migracja przewraca się na pustym haśle do bazy, a to jeszcze nie jest najgorsze:
kontenery `api` i `web-admin` **zostają odtworzone z pustymi sekretami i pustymi
domenami**, czyli produkcja przestaje działać. Naprawa jest jedna — powtórzyć
polecenie z flagą. Jeśli widzisz ten ciąg ostrzeżeń, przerwij i sprawdź komendę,
zanim zaczniesz szukać przyczyny gdzie indziej.

**To potrwa 5–15 minut** — serwer buduje cztery obrazy (API, panel, aplikacja gościa,
zadanie migracji). Zobaczysz dużo tekstu; to normalne.

Gdy komenda się skończy, sprawdź stan:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps -a
```

Prawidłowy wynik:

| Usługa | Oczekiwany stan |
|---|---|
| `caddy` | `Up` |
| `postgres` | `Up (healthy)` |
| `redis` | `Up (healthy)` |
| `migrate` | **`Exited (0)`** ← tak ma być, to jednorazowe zadanie |
| `api` | `Up` |
| `web-guest` | `Up` |
| `web-admin` | `Up` |

`Exited (0)` przy `migrate` oznacza sukces — migracje bazy wykonały się i zadanie się zakończyło.

---

## Krok 9. Sprawdź, czy żyje

```bash
curl -i https://menu.kelbroo.com/api/health
```

Oczekiwana odpowiedź — **kod 200** i:

```json
{ "status": "ok", "database": "up", "redis": "up", "alerts": [] }
```

Przy awarii adres zwraca **503**, a `alerts` wymienia klucze trwających alarmów.
Kod odpowiedzi jest tu ważniejszy od treści: monitor patrzy na niego, a nie czyta
JSON-a. `-i` w poleceniu jest po to, żeby ten kod było widać.

Potem otwórz w przeglądarce:

- `https://kelbroo.com` — strona produktowa
- `https://www.kelbroo.com` — musi przeskoczyć na `https://kelbroo.com`
- `https://menu.kelbroo.com` — aplikacja gościa
- `https://panel.kelbroo.com` — ekran logowania do panelu

We wszystkich przypadkach w pasku adresu musi być **kłódka** (certyfikat wystawił się sam).

> Jeśli przeglądarka krzyczy o certyfikacie, poczekaj 2 minuty i odśwież —
> pobranie certyfikatu zajmuje chwilę po pierwszym wejściu.

---

## Krok 10. Załóż konto właściciela

Baza jest pusta — nie ma jeszcze żadnej restauracji ani konta do logowania.
Zakładamy je jednorazowo.

### 10a. Wgraj restaurację startową

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm migrate pnpm exec tsx prisma/seed.ts
```

Utworzy to demo-restaurację „Bistro Widok" z przykładowym menu, ośmioma stolikami
i **publicznie znanym hasłem** — dlatego następny krok jest **obowiązkowy**.

### 10b. Zmień hasło w panelu

Wejdź na `https://panel.kelbroo.com` i zaloguj się danymi demo:

| Pole | Wartość |
|---|---|
| E-mail | `owner@demo.kelbroo.pl` |
| Hasło | `kelbroo123` |

Kliknij **swoje imię i rolę** w prawym górnym rogu panelu — otworzy się ekran
**Zmiana hasła**. Podaj aktualne (`kelbroo123`), nowe dwukrotnie i zapisz.

> ⚠️ **Zrób to natychmiast po pierwszym zalogowaniu.** Hasło `kelbroo123` jest
> zapisane jawnie w publicznym repozytorium, a panel stoi pod adresem dostępnym
> z internetu.

### 10c. Ustaw własny e-mail i wyłącz konta demo

Wszystko klikasz w panelu — od tej wersji nie trzeba już wchodzić do bazy.

1. **Własny adres.** Kliknij swoje imię w prawym górnym rogu → sekcja **Dane konta**.
   Wpisz nowy adres i zapisz. Od następnego logowania logujesz się nim.
2. **Konta demo.** Wejdź w **Zespół** i wyłącz trzy pozostałe konta demo
   (`manager@`, `kelner@`, `kuchnia@demo.kelbroo.pl`) przyciskiem **Wyłącz**.
   Wyłączone konto nie zaloguje się, mimo że jego hasło jest publicznie znane.
3. **Własny zespół.** Tam samo zakładasz konta kelnerom i kuchni — każde dostaje
   hasło tymczasowe, które pracownik zmieni przy pierwszym logowaniu.

> Adres zapisuje się zawsze małymi literami i bez spacji, niezależnie od tego, co wpiszesz.
> To celowe: logowanie szuka konta po `lower(trim())`, ale porównuje z bazą dosłownie,
> więc adres z wielką literą byłby kontem nie do zalogowania.

Jeśli wolisz skasować konta demo zamiast je wyłączać — panel tego nie robi, zostaje baza:

```bash
source .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U kelbroo -d kelbroo -c \
  "DELETE FROM staff_member WHERE email LIKE '%@demo.kelbroo.pl' AND role <> 'owner';"
```

### 10d. Zaloguj się ponownie

Wyloguj się i zaloguj nowym adresem oraz hasłem ustawionym w kroku 10b.

---

## Krok 11. Ustaw swoją restaurację

Wszystko poniżej robisz już klikając w panelu:

1. **Ustawienia** — zmień nazwę restauracji z „Bistro Widok" na swoją, ustaw walutę,
   język i tryb zamawiania (na razie: `pay_at_table`).
2. **Menu** — zarchiwizuj przykładowe pozycje demo i dodaj swoje.
   (Archiwizacja zamiast usuwania: historyczne rachunki muszą zachować pierwotne nazwy i ceny.)
3. **Stoliki** — usuń niepotrzebne z ośmiu demo, dodaj własne, nadaj im nazwy zgodne z salą.
4. **Kody QR** — przy każdym stoliku pobierz kod QR, wydrukuj i połóż na stoliku.

> ⚠️ Kody QR zawierają adres `menu.kelbroo.com` wpisany **na sztywno w momencie budowania**.
> Jeśli kiedykolwiek zmienisz domenę gościa w `.env.prod`, musisz **przebudować** aplikację
> (`up -d --build`) **i wydrukować kody na nowo**.

---

> **Zmiana w Caddyfile wymaga przebudowania.** Konfiguracja jest wpieczona w obraz
> (`deploy/Dockerfile.caddy`), więc `up -d --build` wystarcza. Nie montujemy jej już
> z dysku: montowanie wyglądało wygodniej, ale zmiana treści pliku nie odtwarzała
> kontenera i nowe trasy po cichu nie wchodziły w życie.

## Strona produktowa na kelbroo.com

Pod apeksem stoi aplikacja **`apps/web-marketing`** — Next.js renderujący strony
statycznie, w osobnym kontenerze, za `reverse_proxy` w Caddym. Zastąpiła podmontowany
plik `design/landing-page.html`; ten został w repozytorium jako referencja wizualna,
ale nie jest już serwowany.

### Gdy wdrożenie już istniało

Krok 7 tworzy `.env.prod` od zera. Jeśli twoje wdrożenie powstało wcześniej, ten plik
już istnieje i **nie ma w nim `LANDING_DOMAIN`** — trzeba go dopisać ręcznie:

```bash
cd /root/kelbroo
grep -q '^LANDING_DOMAIN=' .env.prod || echo 'LANDING_DOMAIN=kelbroo.com' >> .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d caddy
```

Przebudowywanie obrazów jest zbędne — Caddyfile i plik strony są podmontowane, zmienia się
wyłącznie środowisko Caddy'ego.

> ⚠️ **Brak tej zmiennej nie zgłasza błędu.** Compose podstawia wtedy adres zapasowy
> `landing.localhost`, Caddy startuje normalnie, a strona serwuje się pod nazwą, której
> nikt nie rozwiąże. Objaw: `menu.` i `panel.` działają, a apex zwraca błąd TLS.
> Sprawdzenie, które to wychwytuje:
>
> ```bash
> docker compose -f docker-compose.prod.yml --env-file .env.prod exec caddy \
>   sh -c 'echo "$LANDING_DOMAIN"'
> ```
>
> Musi wypisać twoją domenę, nie `landing.localhost`.

### Aktualizacja treści

```bash
cd /root/kelbroo && git pull
```

**I to wszystko.** Żadnego przebudowywania, żadnego restartu — sprawdziłem to:
Caddy czyta plik przy każdym żądaniu, więc nowa wersja jest widoczna od razu po `git pull`.

### Czego ta strona jeszcze nie robi

Landing jest w tej chwili **wizualną wydmuszką**, nie działającym lejkiem sprzedażowym:

| Element | Stan |
|---|---|
| „Zaloguj się" w nagłówku | **działa** — prowadzi na `https://panel.kelbroo.com` |
| „Zacznij 14 dni za darmo", „Wybierz Starter" | przewijają do sekcji cennika; **nie ma rejestracji ani płatności** |
| „Zobacz demo menu", „Porozmawiajmy" | odnośniki puste — brak sekcji docelowej |
| Regulamin, Polityka prywatności, RODO | odnośniki puste — **te dokumenty nie istnieją** |
| Segmenty (restauracje, kawiarnie, bary, hotele, sieci) | odnośniki puste |

Zanim skierujesz na tę stronę płatny ruch, trzeba zamknąć co najmniej dwie rzeczy:
**ścieżkę zakupu abonamentu** (System 1, zakres [docs/01-landing-marketing.md](01-landing-marketing.md))
oraz **dokumenty prawne** — bez regulaminu i polityki prywatności strona zbierająca
zapisy nie spełnia wymogów RODO.

### Docelowo: apps/web-marketing

Statyczny plik jest rozwiązaniem na teraz. Gdy powstanie `apps/web-marketing` (Next.js,
SSG/ISR, z checkoutem abonamentu), podmienia się jeden blok w
[deploy/Caddyfile](../deploy/Caddyfile) — `root` + `file_server` na `reverse_proxy` —
a DNS, certyfikat i adres zostają bez zmian.

---

## Codzienna obsługa

Wszystkie komendy uruchamiaj w `/root/kelbroo`.

**Podgląd logów na żywo** (wyjście: `Ctrl+C`):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f api
```

**Restart wszystkiego:**

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod restart
```

**Aktualizacja do nowej wersji kelbroo:**

```bash
cd /root/kelbroo
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Migracje bazy wykonają się same, dane zostają na miejscu.

**Kopia zapasowa bazy** (rób regularnie!):

```bash
source .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" postgres pg_dump -U kelbroo -d kelbroo \
  > /root/kopia-$(date +%F).sql
```

Plik `/root/kopia-2026-08-22.sql` **skopiuj na swój komputer** — kopia leżąca
wyłącznie na tym samym serwerze nie jest kopią zapasową:

```bash
scp root@31.220.101.55:/root/kopia-*.sql .
```

Włącz też **cotygodniowe backupy Hostingera**: hPanel → VPS → **Backups** (w planie KVM 2 są w cenie).

**Zatrzymanie aplikacji:**

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod stop
```

> ⚠️ **Nigdy nie uruchamiaj `down -v`.** Flaga `-v` kasuje wolumeny, czyli
> **całą bazę danych razem z zamówieniami i menu**.

---

## Cofanie i reset

### Odzyskiwanie dostępu do panelu

Gdy nikt nie może się zalogować, hasło ustawia się bezpośrednio w bazie.
Wygeneruj zaszyfrowaną postać nowego hasła:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm --no-deps migrate \
  node -e 'console.log(require("bcryptjs").hashSync(process.argv[1],10))' 'TwojeNoweHaslo123'
```

Wynikiem jest 60-znakowy ciąg zaczynający się od `$2b$10$`. Wklej go zamiast
`TU_WKLEJ_HASH` i wykonaj **cały blok naraz**:

```bash
source .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U kelbroo -d kelbroo <<'SQL'
UPDATE staff_member SET password_hash='TU_WKLEJ_HASH', is_active=true WHERE role='owner';
SQL
```

> ⚠️ **Nie przerabiaj tego na jedną linię z `-c "..."`.** Hash zawiera znaki `$`,
> które w cudzysłowie zostaną zjedzone przez powłokę — z `$2b$10$Rqurafu...` zostanie
> `b0.WHdR...`, a ty zobaczysz tylko „Nieprawidłowy e-mail lub hasło" i nie będziesz
> wiedział dlaczego. Zapis `<<'SQL'` chroni hash przed podmianą.

Sprawdź, że hash zapisał się w całości — musi mieć **60** znaków:

```bash
source .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U kelbroo -d kelbroo -c \
  "SELECT email, role, is_active, length(password_hash) AS dlugosc FROM staff_member;"
```

Po zalogowaniu zmień hasło normalnie w panelu.

### Cofnięcie kroku 10

Kasuje restaurację demo razem ze wszystkim, co pod nią wisi — kontami, stolikami,
menu i zamówieniami. Wystarczy jedna tabela, reszta idzie kaskadą:

```bash
source .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U kelbroo -d kelbroo -c \
  "DELETE FROM organization;"
```

Prawidłowy wynik: `DELETE 1`. Potem powtarzasz krok 10 od początku.

> ⚠️ Jeśli zdążyłeś już wprowadzić własne menu i stoliki (krok 11), zginą razem z demo.
> Najpierw zrób kopię — polecenie w sekcji **Codzienna obsługa**.

### Reset całej bazy od zera

Gdy chcesz wyczyścić wszystkie tabele i wykonać migracje od nowa:

```bash
cd /root/kelbroo
source .env.prod

docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" postgres pg_dump -U kelbroo -d kelbroo \
  > /root/przed-resetem-$(date +%F).sql

docker compose -f docker-compose.prod.yml --env-file .env.prod stop api

docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U kelbroo -d kelbroo -c \
  "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS app CASCADE; CREATE SCHEMA public;"

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Poczekaj, aż `ps -a` pokaże przy `migrate` stan `Exited (0)`, i dopiero wtedy powtórz krok 10.

> ⚠️ **Kasujesz oba schematy, nie tylko `public`.** Funkcje wyszukujące kody QR mieszkają
> w schemacie `app` i są tworzone przez `CREATE FUNCTION` bez `OR REPLACE`. Skasowanie samego
> `public` zostawia je na miejscu, a ponowna migracja pada na
> `function "resolve_qr_token" already exists` i zostawia bazę w połowie drogi.

Rola aplikacyjna `kelbroo_app` żyje na poziomie serwera bazy, więc reset schematów jej nie
usuwa, a uprawnienia odtwarza migracja. Nie musisz nic nadawać ręcznie.

---

## Gdy coś nie działa

| Objaw | Przyczyna | Co zrobić |
|---|---|---|
| Przeglądarka: „nie można połączyć" | DNS jeszcze nie wskazuje na serwer albo firewall blokuje 80/443 | `nslookup menu.kelbroo.com` — sprawdź IP; sprawdź reguły z kroku 4 |
| Błąd certyfikatu HTTPS | Aplikacja wystartowała, zanim DNS się rozpropagował | Napraw DNS, potem `docker compose -f docker-compose.prod.yml --env-file .env.prod restart caddy` |
| `migrate` ma stan `Exited (1)` | Migracje padły — najczęściej literówka w `.env.prod` | `... logs migrate` i przeczytaj błąd |
| `api` w pętli `Restarting` | API nie łączy się z bazą lub Redisem | `... logs api` — na dole będzie konkretny powód |
| Budowanie przerywa się bez błędu | Zabrakło RAM-u (KVM 1) | Zrób [krok 5b](#krok-5b-tylko-kvm-1--dodaj-swap) i powtórz `up -d --build` |
| `kelbroo.com` zwraca błąd TLS, a `menu.` i `panel.` działają | `LANDING_DOMAIN` nie jest ustawione — Caddy nie zna tej nazwy, więc nie ma dla niej certyfikatu | Dopisz zmienną do `.env.prod` i `up -d caddy` — patrz **Gdy wdrożenie już istniało** |
| `kelbroo.com` pokazuje parking domeny albo starą stronę | Został stary rekord `A` dla `@` lub `www` | Usuń go w **Manage DNS records**, zostaw tylko wpisy z kroku 3 |
| Nie pamiętam hasła do panelu | — | [Odzyskiwanie dostępu](#odzyskiwanie-dostępu-do-panelu) poniżej |
| Logowanie zwraca „Operacja się nie powiodła" | Odpowiedź nie pochodzi z API — panel pyta pod zły adres albo API leży | `curl -i -X POST https://panel.kelbroo.com/api/auth/login -H 'content-type: application/json' -d '{}'` — jeśli to zwraca poprawny JSON, przebuduj panel: `up -d --build` |

Podgląd wszystkich logów naraz:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail 100
```

---

## Skrót do wpisywania komend

Komendy są długie. Możesz raz ustawić skrót `kb`:

```bash
echo "alias kb='docker compose -f /root/kelbroo/docker-compose.prod.yml --env-file /root/kelbroo/.env.prod'" >> ~/.bashrc
source ~/.bashrc
```

Od tej pory zamiast całej komendy piszesz np. `kb ps -a`, `kb logs -f api`, `kb restart`.

---

## Wdrożenie zaplecza kelbroo (System 4)

Zaplecze widzi **wszystkich klientów** — dane firm, abonamenty, terminy. Nie jest
panelem restauracji i nie wystawia się go „przy okazji". Ta procedura jest
świadomie dłuższa niż pozostałe.

Zanim zaczniesz, sprawdź, czy naprawdę chcesz mieć je dostępne z internetu.
Alternatywa bez żadnego wystawiania: tunel SSH z Twojego komputera
(`ssh -L 3004:localhost:3004 root@serwer`) i praca na `http://localhost:3004`.
Wtedy pomiń całą tę sekcję — nic nie musi być publiczne.

### Krok 1. Dodaj rekord DNS

W panelu Hostingera → **Domeny** → `kelbroo.com` → **DNS / Serwery nazw**:

| Pole | Wartość |
|---|---|
| Typ | `A` |
| Nazwa | `admin` |
| Wskazuje na | adres IP twojego VPS (ten sam co `panel`) |
| TTL | zostaw domyślne |

Zapisz i poczekaj, aż zacznie się rozwiązywać:

```bash
dig +short admin.kelbroo.com
```

Ma zwrócić adres serwera. **Nie idź dalej, dopóki nie zwraca** — Caddy będzie
inaczej bezskutecznie dobijał się o certyfikat i zaśmiecał log.

### Krok 2. Uzupełnij `.env.prod`

```bash
cd /root/kelbroo

# Sekret tokenu zaplecza — inny niż JWT_ACCESS_SECRET panelu.
openssl rand -base64 48
```

Dopisz dwie zmienne:

```
ADMIN_JWT_SECRET=<wynik powyższego polecenia>
BACKOFFICE_DOMAIN=admin.kelbroo.com
```

### Krok 3. Wdróż

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Dojdzie nowy obraz `web-backoffice`, a Caddy przebuduje się z nową konfiguracją.

### Krok 4. Załóż konto administratora

Konta zaplecza nie da się założyć przez przeglądarkę — i to jest celowe.
Endpoint tworzący administratora platformy byłby pierwszą rzeczą, której szuka
atakujący.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm migrate \
  pnpm exec tsx scripts/create-platform-admin.ts \
  "twoj@adres.pl" "Imię Nazwisko" "haslo-co-najmniej-12-znakow"
```

> Polecenie idzie przez usługę **`migrate`**, nie `api`. Obraz uruchomieniowy API
> zawiera wyłącznie skompilowany `dist` i zależności — nie ma w nim ani skryptów,
> ani projektu pnpm, więc odpowiada `No projects found in /app`. Ten sam obraz
> `migrate` uruchamia migracje i seed.

Hasło musi mieć **12 znaków** — więcej niż w panelu, bo to konto widzi wszystkich
klientów. Użyj menedżera haseł, nie wymyślaj.

#### Zmiana adresu istniejącego konta

**Nie rób tego skryptem powyżej.** `create-platform-admin.ts` robi `upsert` po
adresie, więc uruchomiony z nowym adresem **założy drugie konto** zamiast zmienić
pierwsze — a dwa czynne konta administratora platformy, o jednym zapomniane, to
nie jest pomyłka kosmetyczna. Do zmiany adresu jest osobne polecenie:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm migrate \
  pnpm exec tsx scripts/rename-platform-admin.ts \
  "stary@adres.pl" "kontakt@kelbroo.com"
```

Hasło zostaje bez zmian. **Drugi składnik logowania idzie od tej chwili na nowy
adres** — zanim się wylogujesz, sprawdź, że masz do niego dostęp, bo kod
jednorazowy jest jedyną drogą do środka.

Skrypt odmawia, gdy starego adresu nie ma (wypisze wtedy istniejące konta) albo
gdy nowy jest już zajęty.

### Krok 5. Sprawdź, że działa

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://admin.kelbroo.com/login
```

Oczekiwane `200`. Potem zaloguj się w przeglądarce: po haśle panel poprosi
o sześciocyfrowy kod wysłany na adres administratora. Jeśli kod nie przychodzi,
sprawdź `docker compose -f docker-compose.prod.yml --env-file .env.prod logs api | grep -i poczt` — brak konfiguracji SMTP
zatrzymuje logowanie na tym kroku.

### Czego ta procedura nie załatwia

Zaplecze widzi dane wszystkich klientów, a **chroni je dziś wyłącznie hasło**.
Warto to wiedzieć, a nie odkryć później:

- **Drugi składnik idzie pocztą.** Logowanie wymaga kodu z e-maila, więc samo
  hasło nie wystarcza — ale przejęta skrzynka administratora już tak. Konto
  pocztowe użyte przy zakładaniu administratora **musi mieć własne 2FA**.
  Wymaga to działającego SMTP (`SMTP_HOST` i reszta w `.env.prod`): bez poczty
  kod nigdzie nie dotrze i **nikt się nie zaloguje**.
- **Brak ograniczenia po adresie IP.** Zostało świadomie odłożone (2026-08-26).
  Gdy zechcesz je włączyć, wraca jako blok `client_ip` w Caddyfile i zamyka
  dostęp wszystkim spoza listy — najskuteczniejsza pojedyncza zmiana, jeśli
  pracujesz ze stałych miejsc.
- **Brak dziennika działań administratora.** Nie wiadomo, kto co obejrzał.
- **Nazwa subdomeny nie jest zabezpieczeniem.** `admin` jest w każdym słowniku
  skanerów, ale nawet nieoczywista nazwa niewiele by dała: certyfikat trafia
  do publicznych rejestrów Certificate Transparency i subdomenę da się tam
  znaleźć w kilka minut od wystawienia.

> Wariant bez wystawiania czegokolwiek: tunel SSH
> (`ssh -L 3004:localhost:3004 root@serwer`) i praca na `http://localhost:3004`.
> Wymaga wystawienia portu kontenera na localhost serwera. Przy jednoosobowym
> zespole bywa rozsądniejszy niż publiczny adres.

## Włączenie płatności za abonament (PayU)

Do tej pory abonamenty przedłużało się ręcznie z zaplecza. Ta procedura włącza
sprzedaż: klient wybiera plan w panelu i płaci BLIK-iem, przelewem albo kartą.

**Zanim zaczniesz — jedna rzecz, której nie da się cofnąć jednym poleceniem.**
`PAYU_ENV` decyduje, czy pieniądze są prawdziwe. `sandbox` to środowisko testowe
(nic nie wpływa), `production` to Twoje konto. Pomyłka w tej jednej zmiennej jest
najdroższym błędem w całym wdrożeniu: przy `sandbox` klient „zapłaci", abonament
się przedłuży, a na koncie nie będzie ani grosza.

### Krok 1. Wypisz dane z panelu PayU

Zaloguj się na [secure.payu.com](https://secure.payu.com) → **Moje sklepy** →
punkt płatności (POS). Potrzebujesz czterech rzeczy:

| Co | Gdzie w panelu PayU |
|---|---|
| **ID punktu płatności** (POS ID) | przy nazwie punktu |
| **Klucz OAuth — client_id** | sekcja „Klucze konfiguracji / OAuth" |
| **Klucz OAuth — client_secret** | tamże |
| **Drugi klucz (MD5)** | sekcja „Klucze konfiguracji" |

Drugi klucz nie służy do płacenia — służy do **sprawdzania podpisu powiadomień
o wpłacie**. To on rozstrzyga, komu przedłużyć abonament, więc traktuj go jak
hasło do konta bankowego. Kto go zna, może sobie opłacić dowolny abonament.

### Krok 2. Ustaw adres powiadomień w PayU

W konfiguracji POS-u wskaż adres powiadomień (notify URL):

```
https://panel.kelbroo.com/api/billing/notify
```

Ten adres musi być publicznie osiągalny — Caddy kieruje `/api` na domenie panelu
do API, więc żadnej dodatkowej konfiguracji nie trzeba. Sprawdź, że odpowiada:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://panel.kelbroo.com/api/billing/notify
```

Oczekiwane **401** — żądanie bez podpisu ma być odrzucone. `404` znaczy, że API
nie zostało jeszcze przebudowane; `200` znaczyłoby, że coś jest bardzo źle.

Jeśli PayU wymaga też adresu powrotu, podaj `https://panel.kelbroo.com/abonament/wynik`.

### Krok 3. Uzupełnij `.env.prod`

```bash
cd /root/kelbroo
nano .env.prod
```

Dopisz (wzór w `.env.prod.example`):

```
PAYU_ENV=production
PAYU_POS_ID=<ID punktu płatności>
PAYU_CLIENT_ID=<client_id>
PAYU_CLIENT_SECRET=<client_secret>
PAYU_SECOND_KEY=<drugi klucz MD5>
```

Zanim przejdziesz dalej — przeczytaj `PAYU_ENV` jeszcze raz.

### Krok 4. Wdróż

```bash
cd /root/kelbroo
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build api web-admin
```

Migracja dokłada tabelę zamówień abonamentu i dane do faktury na organizacji.

### Krok 5. Sprawdź na żywo

Zaloguj się na `https://panel.kelbroo.com` jako właściciel i wejdź w
**Ustawienia → Abonament**. Powinieneś zobaczyć plany z cenami. Komunikat
„Płatności online nie są jeszcze uruchomione" znaczy, że którejś zmiennej brakuje
— API czyta je przy starcie, więc po poprawce trzeba przebudować kontener.

Pierwszy zakup zrób sam, najtańszym planem, prawdziwymi pieniędzmi. Przelew na
własne konto firmowe kosztuje tylko prowizję PayU, a jest jedynym sposobem, żeby
sprawdzić, że **produkcyjne** klucze działają. Po zapłacie:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs api | grep -i "zaksięgowano"
```

Ma pokazać kwotę i datę, do której przedłużył się abonament. Na
`kontakt@kelbroo.com` przyjdzie wiadomość „Faktura do wystawienia" z kompletem
danych nabywcy.

### Czego ta procedura nie załatwia

- **Faktury wystawiasz ręcznie.** kelbroo przysyła dane, resztę robisz w programie
  księgowym. Faktura VAT przy sprzedaży B2B jest obowiązkowa, nie opcjonalna —
  a termin liczy się od sprzedaży, nie od tego, kiedy zajrzysz do skrzynki.
- **Abonament nie odnawia się sam.** Klient płaci za okres i po jego końcu panel
  przestaje przyjmować zamówienia. Klient dostaje o tym trzy wiadomości — trzy dni
  przed, w dniu wygaśnięcia i trzy dni po — ale **kliknięcia w nie musi dokonać sam**.
  Wysyłka wymaga działającego SMTP; bez niego przypomnienia lądują wyłącznie w logu.
- **Zwroty robisz w panelu PayU.** kelbroo ich nie zna i nie cofnie po nich
  abonamentu — trzeba go skrócić ręcznie z zaplecza.

### Gdy klient twierdzi, że zapłacił, a abonament się nie przedłużył

Najpierw zaczekaj **kwadrans**. Co dziesięć minut zadanie uzgadniające pyta PayU
o zamówienia wiszące dłużej niż 15 minut i samo księguje te opłacone — w większości
przypadków problem zniknie bez Twojego udziału, a na `kontakt@kelbroo.com` przyjdzie
wiadomość „Wpłata odzyskana przez uzgadnianie".

**Ta wiadomość jest sygnałem, że coś jest zepsute**, mimo że klient nie ucierpiał:
znaczy, że powiadomienie od PayU nie dotarło i nie dotrze przy następnej wpłacie.
Sprawdź wtedy dwie rzeczy — adres powiadomień w panelu PayU (ma wskazywać na
`https://panel.kelbroo.com/api/billing/notify`) oraz log pod kątem odrzuconych podpisów:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs api | grep -i "podpis\|uzgadnianie"
```

Jeśli po kwadransie nic się nie zmieniło, sprawdź, co PayU mówi o tym zamówieniu:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs api | grep -i "PayU nie podał"
```

## Restauracja pokazowa (demo menu)

Sekcja „Zobacz to oczami gościa" na stronie produktowej prowadzi do
`menu.kelbroo.com/t/demo`. Ten adres nie zadziała, dopóki restauracja pokazowa
nie zostanie założona — a to jednorazowa czynność na środowisko.

### Krok 1. Załóż ją

```bash
cd /root/kelbroo
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  run --rm migrate pnpm exec tsx scripts/seed-public-demo.ts
```

Skrypt jest bezpieczny do powtórzenia — drugie uruchomienie nie utworzy drugiej
restauracji, nie zduplikuje menu ani nie wgra zdjęć po raz drugi. Uruchamiaj go
przez usługę **`migrate`**, nie `api`: obraz produkcyjny API zawiera wyłącznie
skompilowany `dist`.

Ten sam skrypt wgrywa **zdjęcia dań** (od 2026-08-27). Jeśli restaurację pokazową
założyłeś wcześniej, uruchom go ponownie — dołoży brakujące zdjęcia i nie ruszy
reszty.

### Krok 2. Sprawdź

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://menu.kelbroo.com/t/demo
```

Oczekiwane `200`. Potem otwórz ten adres w przeglądarce — na samej górze musi
stać pomarańczowy pasek **„To jest wersja demonstracyjna — zamówienia nie
trafiają do żadnej kuchni"**. Jeśli go nie ma, restauracja została założona bez
flagi i trzeba to naprawić, zanim ktokolwiek zamówi w przekonaniu, że dostanie
jedzenie.

### Co dzieje się dalej samo

- **Zdjęcia dań** leżą w wolumenie `media`, tym samym co zdjęcia klientów.
  Wgrywa je skrypt z kroku 1 — nie ma osobnej czynności.
- **Co pół godziny znikają wizyty zwiedzających** starsze niż 30 minut, razem
  z ich zamówieniami. Bez tego stolik pokazowy po tygodniu pokazywałby nowemu
  odwiedzającemu cudzy rachunek sprzed dni.
- Menu, stolik i sama restauracja zostają — sprzątanie ich nie dotyka.
- Restauracja pokazowa **nie liczy się jako klient**: nie ma jej w statystykach
  zaplecza i nie dostaje przypomnień o abonamencie.

### Czego ta procedura nie załatwia

Przy stoliku pokazowym siedzą naraz nieznajomi z internetu i **widzą nawzajem
swoje zamówienia oraz notatki do dań** — dokładnie tak, jak działa wspólny
rachunek w prawdziwym lokalu. Nie ma tam moderacji; jedyną ochroną jest to, że
wszystko znika po pół godzinie. Gdyby okazało się to problemem, następnym krokiem
jest skrócenie tego czasu albo wyłączenie pola notatki w restauracji pokazowej.

---

## Płatność nie została zaksięgowana — co sprawdzić

Klient zapłacił, wrócił z bramki i widzi **„Potwierdzenie jeszcze nie dotarło"**.
Ten ekran pyta serwer przez **30 sekund** (dwadzieścia prób co półtorej sekundy)
i po tym czasie mówi „jeszcze nie" — to **nie jest** komunikat o błędzie.

Pytanie do rozstrzygnięcia jest jedno: **czy operator do nas nie zadzwonił, czy
zadzwonił, a my odrzuciliśmy.** To dwie różne awarie w dwóch różnych miejscach,
a z zewnątrz wyglądają identycznie.

### 1. Czy nasz adres powiadomień w ogóle odpowiada

```bash
curl -i -X POST https://panel.kelbroo.com/api/billing/notify
```

Oczekiwane: **401** z komunikatem o braku treści. To znaczy, że żądanie doszło
do API — trasa i certyfikat działają. **404 albo 502** znaczą, że powiadomienie
PayU nie miało jak do nas trafić i szukać trzeba w Caddym albo w kontenerze.

### 2. Co widzi nasz log

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs api --since 1h \
  | grep -i "powiadomienie\|payu\|uzgadnianie"
```

| Co w logu | Co to znaczy |
|---|---|
| `Powiadomienie PayU: <id> → completed` | Doszło i zostało przyjęte. Problem jest gdzie indziej — sprawdź zamówienie w bazie |
| `Odrzucone powiadomienie PayU: …` | Doszło i **odrzuciliśmy podpis**. Prawie zawsze zły `PAYU_SECOND_KEY` — np. klucz z piaskownicy na produkcji |
| `Nieznany status PayU „…"` | Doszło, ale operator przysłał stan, którego nie znamy. Uzupełnij mapę statusów |
| **cisza** | **Powiadomienie do nas nie dotarło.** Szukaj po stronie PayU (punkt 3) |

### 3. Co widzi PayU

W panelu operatora, przy zamówieniu, jest historia powiadomień z kodami
odpowiedzi. Trzy najczęstsze przyczyny ciszy po naszej stronie:

- **Płatność wisi w `WAITING_FOR_CONFIRMATION`** — POS ma wyłączony automatyczny
  odbiór, więc środki są zablokowane, ale nie zaksięgowane. Dla nas to wciąż
  „brak wpłaty" i **tak ma być**; włącz automatyczny odbiór w konfiguracji POS.
- **Powiadomienia wyłączone albo skierowane gdzie indziej** w ustawieniach punktu
  płatności.
- **Płatność nie doszła do skutku** — status `CANCELED` albo `REJECTED`.

### 4. Siatka bezpieczeństwa działa sama

Nie trzeba nic ratować ręcznie przez pierwszy kwadrans. **Zadanie uzgadniające
chodzi co dziesięć minut** i pyta operatora o zamówienia wiszące dłużej niż
**15 minut** — jeśli wpłata jest, zaksięguje ją samo i przyśle wiadomość
„Wpłata odzyskana przez uzgadnianie". Ta wiadomość jest zarazem sygnałem, że
**powiadomienia nie działają** i przyczyna zostaje do naprawienia.

## Wgranie zdjęcia dania kończy się błędem 500

Objaw myli, bo połowa funkcji działa: **zdjęcia wgrane wcześniej wyświetlają się
normalnie**, a każde nowe wgranie z panelu wraca z `500`.

Przyczyną jest właściciel katalogu z plikami. Wolumen Dockera zamontowany pod
ścieżką, której obraz nie tworzy, powstaje jako `root:root`, a API chodzi jako
`kelbroo`. Odczyt działa (pliki mają `644`), zapis nie. Ten sam efekt daje
zadanie `migrate`, które chodzi jako root i wgrywa zdjęcia restauracji
pokazowej.

**Naprawia się samo przy wdrożeniu od 2026-09-02.** Kontener API startuje jako
root wyłącznie po to, żeby ustawić właściciela katalogu, i schodzi na `kelbroo`
przed uruchomieniem procesu ([apps/api/docker-entrypoint.sh](../apps/api/docker-entrypoint.sh)).
Wystarczy przebudować obraz:

```bash
docker compose -f docker-compose.prod.yml up -d --build api
```

Sprawdzenie, że zadziałało:

```bash
# Katalog należy do kelbroo, a proces nie chodzi jako root.
docker compose -f docker-compose.prod.yml exec api ls -ld /media
docker compose -f docker-compose.prod.yml exec api id -un
```

Gdyby błąd wrócił, w logu API stoi dokładna przyczyna razem ze ścieżką —
komunikat `Zapis zdjęcia w … nie powiódł się`. Sam panel mówi wtedy „Serwer nie
może zapisać pliku w katalogu na zdjęcia" zamiast gołej pięćsetki.

## Alarmy o awariach

Od 2026-08-27 API samo zgłasza część awarii pocztą na adres z `MAIL_NOTIFY`
(domyślnie `kontakt@kelbroo.com`). Nie ma tu nic do skonfigurowania poza SMTP,
który i tak musi działać — ale warto wiedzieć, co przychodzi i czego **nie**
przyjdzie.

### Co zgłasza samo

| Alarm | Kiedy | Dlaczego to nie może umknąć |
|---|---|---|
| `usluga.baza` | PostgreSQL nie odpowiada na `SELECT 1` | Serwer stoi i odpowiada na żądania, więc z zewnątrz wygląda na sprawny |
| `usluga.redis` | Redis nie odpowiada na `PING` | Panele przestają dostawać zdarzenia na żywo — **bez żadnego komunikatu**. Obsługa bierze ciszę za brak zamówień |
| `zadanie.*` | Zadanie cykliczne zakończyło się błędem | Uzgadnianie płatności to jedyny mechanizm odzyskujący zgubione wpłaty |
| `platnosci.operator` | PayU odrzuca pytania o zamówienia | Dopóki trwa, wpłaty bez powiadomienia nie zostaną odzyskane |
| `platnosci.zakup` | Klient nie mógł rozpocząć płatności | Klient zwykle nie dzwoni — po prostu odchodzi |
| `proces.nieobsluzony-blad` | Odrzucona obietnica bez obsługi | Potrafi wyłączyć API po cichu |

Każdy alarm ma **klucz** (widoczny w stopce wiadomości i w `/api/health`).
Powtórzenia tego samego klucza są wyciszane na **godzinę** i wychodzą potem jedną
wiadomością z liczbą wystąpień — sto czterdzieści cztery wiadomości dziennie
o tej samej awarii przestałyby być czytane. Gdy awaria ustąpi, przychodzi
odwołanie z czasem jej trwania.

### Czego nie zgłosi

**Własnej śmierci.** Martwy proces nie wyśle wiadomości o tym, że nie żyje —
tak samo padnięta maszyna, zatrzymany Docker czy wygasły certyfikat. To zadanie
dla monitora stojącego **poza** serwerem, odpytującego `/api/health` (zwraca
`503` przy awarii). Nie jest jeszcze podłączony — zadanie czeka w
[docs/todo.md §7](todo.md).

### Sprawdzenie, że alarmy chodzą

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod stop redis
sleep 90
curl -i https://menu.kelbroo.com/api/health   # oczekiwane 503, redis: down
docker compose -f docker-compose.prod.yml --env-file .env.prod start redis
```

W ciągu dwóch minut na `MAIL_NOTIFY` powinny przyjść dwie wiadomości: alarm
i odwołanie. **Rób to poza godzinami serwisu** — przez te półtorej minuty panele
nie dostają zdarzeń na żywo.
