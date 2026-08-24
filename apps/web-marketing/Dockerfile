# syntax=docker/dockerfile:1
#
# Budowane z korzenia monorepo:
#   docker build -f apps/web-marketing/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY apps/web-marketing/package.json apps/web-marketing/
RUN pnpm install --frozen-lockfile --filter @kelbroo/web-marketing...

FROM deps AS build
COPY packages/config packages/config
COPY packages/types packages/types
COPY apps/web-marketing apps/web-marketing
# Regulamin i polityka prywatności są renderowane przy budowaniu — to treść
# strony, nie dokumentacja. Reszta `docs` zostaje poza obrazem (.dockerignore).
COPY docs/legal docs/legal
# `@kelbroo/types` jest publikowany jako `dist`, a `dist` nie wchodzi do obrazu
# (.dockerignore) — bez tego kroku Next nie rozwiąże importu. Formularz
# rejestracji sprawdza NIP tą samą funkcją co serwer.
RUN pnpm --filter @kelbroo/types build \
 && pnpm --filter @kelbroo/web-marketing build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web-marketing/.next/standalone ./
COPY --from=build /app/apps/web-marketing/.next/static ./apps/web-marketing/.next/static
# `public` niesie logo, do którego odwołują się wiadomości e-mail. Bez tej linii
# obrazek w powitaniu dawałby 404 — i to widoczne dopiero w cudzej skrzynce.
COPY --from=build /app/apps/web-marketing/public ./apps/web-marketing/public

RUN addgroup -S kelbroo && adduser -S kelbroo -G kelbroo && chown -R kelbroo:kelbroo /app
USER kelbroo

EXPOSE 3000
CMD ["node", "apps/web-marketing/server.js"]
