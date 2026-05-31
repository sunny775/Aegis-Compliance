# syntax=docker/dockerfile:1
# Web image: builds the Vite SPA and serves the static bundle via nginx with a
# client-side-routing fallback. Build context must be the REPO ROOT.

# ---- build ----
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
# API base URL is baked at build time (it ships in the client bundle — it is NOT
# a secret; only VITE_-prefixed values are exposed to the browser).
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @cda/web build

# ---- runtime ----
FROM nginx:alpine AS runtime
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
