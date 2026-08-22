# syntax=docker/dockerfile:1
#
# Budowane z korzenia monorepo:
#   docker build -f apps/api/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- zależności ------------------------------------------------------------
# Manifesty kopiujemy osobno, żeby warstwa z instalacją nie unieważniała się
# przy każdej zmianie kodu.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @kelbroo/api... --filter @kelbroo/types...

# --- budowanie -------------------------------------------------------------
FROM deps AS build
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @kelbroo/types build \
 && pnpm --filter @kelbroo/api exec prisma generate \
 && pnpm --filter @kelbroo/api build

# Zależności produkcyjne w osobnym katalogu.
RUN pnpm --filter @kelbroo/api --prod deploy /runtime

# Klienta Prismy generujemy DRUGI raz, już w /runtime. `pnpm deploy` buduje tam
# node_modules od nowa ze store'a, więc artefakty wygenerowane wcześniej w /app
# nie są przenoszone — bez tego kroku obraz startuje i pada na
# „@prisma/client did not initialize yet".
RUN cp -r apps/api/prisma /runtime/prisma \
 && cd /runtime \
 && /app/apps/api/node_modules/.bin/prisma generate --schema /runtime/prisma/schema.prisma

# --- zadanie migracyjne ----------------------------------------------------
# Migracje potrzebują CLI Prismy, a to jest devDependency — w obrazie
# uruchomieniowym go nie ma. Osobny cel oparty na `build` daje CLI w wersji
# przypiętej lockfile'em; `npx prisma` ściągałby przy każdym starcie najnowszą
# (dziś 7.x) i migrował nią bazę obsługiwaną klientem 6.x.
FROM build AS migrate
WORKDIR /app/apps/api
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# --- obraz uruchomieniowy --------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=build /runtime/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
# Bez schematu, migracji i skryptów: obraz uruchomieniowy tylko serwuje API,
# a schemat jest wkompilowany w wygenerowanego klienta. Migracje i seed mają
# własny cel `migrate` powyżej.

RUN addgroup -S kelbroo && adduser -S kelbroo -G kelbroo && chown -R kelbroo:kelbroo /app
USER kelbroo

EXPOSE 4000
CMD ["node", "dist/main.js"]
