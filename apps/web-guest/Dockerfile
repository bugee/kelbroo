# syntax=docker/dockerfile:1
#
# Budowane z korzenia monorepo:
#   docker build -f apps/web-guest/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY apps/web-guest/package.json apps/web-guest/
RUN pnpm install --frozen-lockfile --filter @kelbroo/web-guest...

FROM deps AS build
COPY packages packages
COPY apps/web-guest apps/web-guest
# Bez NEXT_PUBLIC_API_URL aplikacja woła /api na własnym originie — dokładnie
# to, czego chcemy za reverse proxy. Adres podajemy tylko, gdy API stoi gdzie
# indziej, i musi być znany TERAZ, bo Next wkompilowuje go w bundle.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GUEST_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GUEST_URL=$NEXT_PUBLIC_GUEST_URL
# `@kelbroo/types` jest publikowany jako `dist`, a `dist` nie wchodzi do obrazu
# (patrz .dockerignore) — bez tego kroku Next nie rozwiąże importu. Lokalnie
# katalog zwykle istnieje po `pnpm build`, więc brak tej linii ujawnia się
# dopiero przy budowaniu obrazu.
RUN pnpm --filter @kelbroo/types build \
 && pnpm --filter @kelbroo/web-guest build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web-guest/.next/standalone ./
COPY --from=build /app/apps/web-guest/.next/static ./apps/web-guest/.next/static
COPY --from=build /app/apps/web-guest/public ./apps/web-guest/public

RUN addgroup -S kelbroo && adduser -S kelbroo -G kelbroo && chown -R kelbroo:kelbroo /app
USER kelbroo

EXPOSE 3000
CMD ["node", "apps/web-guest/server.js"]
