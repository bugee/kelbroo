# syntax=docker/dockerfile:1
#
# Budowane z korzenia monorepo:
#   docker build -f apps/web-backoffice/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/config/package.json packages/config/
COPY apps/web-backoffice/package.json apps/web-backoffice/
RUN pnpm install --frozen-lockfile --filter @kelbroo/web-backoffice...

FROM deps AS build
COPY packages/config packages/config
COPY apps/web-backoffice apps/web-backoffice
# Zaplecze nie sięga po `@kelbroo/types` ani `@kelbroo/ui` — nie ma czego
# kompilować przed nim. Paletę bierze z `@kelbroo/config` przez CSS.
RUN pnpm --filter @kelbroo/web-backoffice build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web-backoffice/.next/standalone ./
COPY --from=build /app/apps/web-backoffice/.next/static ./apps/web-backoffice/.next/static

RUN addgroup -S kelbroo && adduser -S kelbroo -G kelbroo && chown -R kelbroo:kelbroo /app
USER kelbroo

EXPOSE 3000
CMD ["node", "apps/web-backoffice/server.js"]
