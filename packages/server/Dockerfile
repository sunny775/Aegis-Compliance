# syntax=docker/dockerfile:1
# Server image: builds the API in a pnpm workspace and runs it.
# Build context must be the REPO ROOT (the workspace lockfile lives there).

# ---- build ----
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
# .dockerignore keeps node_modules/dist/.env out — deps are installed fresh
# (this is where sharp's linux native binary is built) and the server is compiled.
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @cda/server build

# ---- runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    DOCS_DIR=/app/docs \
    TRANSFORMERS_CACHE=/app/.cache \
    PORT=4000
# Carry over the installed workspace (pnpm's symlinked layout), the built server,
# and the source PDFs that the boot-time seed ingests.
COPY --from=build /app /app
WORKDIR /app/packages/server
EXPOSE 4000
# The app reads PORT from the environment (Railway injects it); listening on it is required.
CMD ["node", "dist/index.js"]
