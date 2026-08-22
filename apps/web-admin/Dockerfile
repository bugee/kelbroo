# syntax=docker/dockerfile:1
#
# Budowane z korzenia monorepo:
#   docker build -f apps/web-admin/Dockerfile .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY apps/web-admin/package.json apps/web-admin/
RUN pnpm install --frozen-lockfile --filter @kelbroo/web-admin...

FROM deps AS build
COPY packages packages
COPY apps/web-admin apps/web-admin
# Bez NEXT_PUBLIC_API_URL aplikacja woła /api na własnym originie — dokładnie
# to, czego chcemy za reverse proxy. Adres podajemy tylko, gdy API stoi gdzie
# indziej, i musi być znany TERAZ, bo Next wkompilowuje go w bundle.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GUEST_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GUEST_URL=$NEXT_PUBLIC_GUEST_URL
RUN pnpm --filter @kelbroo/web-admin build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web-admin/.next/standalone ./
COPY --from=build /app/apps/web-admin/.next/static ./apps/web-admin/.next/static
COPY --from=build /app/apps/web-admin/public ./apps/web-admin/public

RUN addgroup -S kelbroo && adduser -S kelbroo -G kelbroo && chown -R kelbroo:kelbroo /app
USER kelbroo

EXPOSE 3000
CMD ["node", "apps/web-admin/server.js"]
