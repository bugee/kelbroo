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
COPY apps/web-marketing/package.json apps/web-marketing/
RUN pnpm install --frozen-lockfile --filter @kelbroo/web-marketing...

FROM deps AS build
COPY packages/config packages/config
COPY apps/web-marketing apps/web-marketing
# Bez kroku budowania `@kelbroo/types`: strona produktowa celowo nie sięga po
# pakiety współdzielone, więc nie ma czego kompilować przed nią.
RUN pnpm --filter @kelbroo/web-marketing build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web-marketing/.next/standalone ./
COPY --from=build /app/apps/web-marketing/.next/static ./apps/web-marketing/.next/static

RUN addgroup -S kelbroo && adduser -S kelbroo -G kelbroo && chown -R kelbroo:kelbroo /app
USER kelbroo

EXPOSE 3000
CMD ["node", "apps/web-marketing/server.js"]
