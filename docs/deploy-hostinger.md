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
curl https://menu.kelbroo.com/api/health
```

Oczekiwana odpowiedź:

```json
{"status":"ok","database":"up"}
```

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

### 10c. Ustaw własny e-mail i usuń konta demo

Adresu e-mail nie da się jeszcze zmienić z panelu — to jedno polecenie w bazie.
**Wpisz adres małymi literami:**

```bash
source .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U kelbroo -d kelbroo -c \
  "UPDATE staff_member SET email='szef@kelbroo.com', name='Twoje Imie' WHERE role='owner';
   DELETE FROM staff_member WHERE email LIKE '%@demo.kelbroo.pl';"
```

Prawidłowy wynik to dwie linie: `UPDATE 1` i `DELETE 3`.

> ⚠️ **Adres musi być zapisany małymi literami i bez spacji.** Logowanie szuka
> konta po `lower(trim())` tego, co wpiszesz w formularzu, ale porównuje z zawartością
> bazy dosłownie. `Szef@TwojaDomena.pl` w bazie oznacza konto, którego nie da się
> zalogować — i to bez żadnej wskazówki, co jest nie tak.

Sprawdź wynik:

```bash
source .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T \
  -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U kelbroo -d kelbroo -c \
  "SELECT '['||email||']' AS email, email = lower(trim(email)) AS zaloguje_sie,
          role, is_active FROM staff_member;"
```

Kolumna `zaloguje_sie` musi pokazywać `t`, a w nawiasach nie może być spacji.

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

## Strona produktowa na kelbroo.com

Pod apeksem stoi **statyczny plik** [design/landing-page.html](../design/landing-page.html),
podmontowany do Caddy'ego jako `index.html`. Nie ma osobnego kontenera ani procesu
budowania — Caddy serwuje plik prosto z dysku.

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
