# Deployment

Two supported paths:

1. **Local / self-host** — `docker compose up` runs the whole app in one command.
2. **Cloud** — API on **Railway** (Docker), web on **Vercel** (static SPA).

> **Security (ARCHITECTURE.md §12).** The `ANTHROPIC_API_KEY` lives only on the server, supplied as an environment variable. It is never committed (`.env` is git-ignored, `.env.example` has no secret), never copied into an image (`.dockerignore` excludes `.env`), and never in the client bundle (only `VITE_`-prefixed values reach the browser). See [Key-safety check](#key-safety-check).

---

## Option A — One-command local run (Docker Compose)

```bash
# from the repo root
export ANTHROPIC_API_KEY=sk-ant-...     # or put it in a git-ignored .env file
docker compose up --build
```

- **Web** → http://localhost:5173 &nbsp;·&nbsp; **API** → http://localhost:4000
- The `api` container ingests `docs/` and pre-runs the Tyre↔RS13 gap report on boot.
- The `web` container is the built SPA served by nginx (with client-route fallback), talking to the API at `http://localhost:4000`.

Skip the boot-time gap pre-run (faster, no Claude spend) by uncommenting `SEED_PRERUN_GAP: "false"` in `docker-compose.yml`.

---

## Option B — Cloud (Railway API + Vercel web)

### B1. API on Railway (Docker)

1. **New Project → Deploy from GitHub repo**, pick this repo.
2. In the service **Settings → Build**: set **Dockerfile Path** to `packages/server/Dockerfile` and **Root Directory** to the repo root (`/`). Railway builds the image with the repo as the build context (required — the pnpm lockfile is at the root).
3. **Variables** (Settings → Variables):
   | Variable | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your key (**secret**) |
   | `CORS_ORIGIN` | your Vercel URL, e.g. `https://your-app.vercel.app` |
   | `CLAUDE_MODEL_CHEAP` | `claude-haiku-4-5` *(optional)* |
   | `CLAUDE_MODEL_REASONING` | `claude-sonnet-4-6` *(optional)* |
   | `AUTH_USERNAME` / `AUTH_PASSWORD` | your mock creds *(optional)* |
   - **Do not set `PORT`** — Railway injects it; the server reads `process.env.PORT` and listens on it.
   - `DOCS_DIR` is already baked into the image (`/app/docs`); leave it unset.
4. **Networking → Generate Domain** to get the public API URL.
5. **Health check**: set the path to `/health` (Settings → Deploy → Healthcheck Path). The HTTP server starts listening immediately, so health passes within seconds.
6. **Recommended resources**: ≥ **1 GB** memory (the local embedding model + RS17's 171 pages). If memory-constrained, set `SEED_PRERUN_GAP=false` and run gap analysis on demand from the UI.

**Seed + pre-run on boot — confirmed.** `node dist/index.js` calls `seedCorpus()` inside the `app.listen` callback. In the container it:
- reads the six PDFs from `/app/docs` (copied into the image),
- ingests them with local embeddings (the model downloads once from Hugging Face to `TRANSFORMERS_CACHE=/app/.cache` — the container needs outbound network, which Railway allows),
- pre-runs the **ACME Tyre ↔ RS13** gap report (cached in memory).

Seeding runs **after** the server is listening, so it never blocks the health check; the gap report finishes in the background (watch the deploy logs for `Seed complete: 6 documents ingested; Tyre↔RS13 gap report pre-run`). Because storage is in-memory, a restart re-seeds and re-bills the pre-run (cents) — set `SEED_PRERUN_GAP=false` to avoid that and trigger gap analysis from the UI instead.

### B2. Web on Vercel

1. **New Project → Import** this repo.
2. **Root Directory**: `packages/web`. Vercel detects the **Vite** preset and pnpm. `packages/web/vercel.json` pins the build command (`pnpm build`), output (`dist`), and the SPA rewrite (all routes → `/index.html`).
3. **Environment Variables**: set `VITE_API_URL` to the Railway API URL (e.g. `https://your-api.up.railway.app`). This is baked into the bundle at build time — it is **not** a secret.
4. **Deploy**. Note the production URL, then go back to Railway and set `CORS_ORIGIN` to exactly that origin (and redeploy the API).

> **CORS note:** the API allows a single origin. Vercel *preview* deployments get unique URLs that the API will reject — test against the production domain, or extend `CORS_ORIGIN` handling if you need previews.

---

## Single-service alternative (backend serves the frontend on `/`)

See the README's deployment note. In short: it's possible and convenient (one URL, no CORS), but cleanly requires mounting the API under `/api` first, because the SPA route `/documents/:id` collides with the API route `GET /documents/:id`. The split above avoids that with zero code changes and gives the SPA a CDN.

---

## Key-safety check

Run these from the repo root — all should report the key is absent from tracked files and the client bundle:

```bash
# .env is ignored; only .env.example is tracked
git check-ignore packages/server/.env && echo "server .env ignored ✓"
git ls-files | grep -E '\.env' || echo "no .env tracked (only .env.example) ✓"

# the key is never referenced in the web source or the built bundle
grep -rn "ANTHROPIC" packages/web/src || echo "no ANTHROPIC reference in web/src ✓"
pnpm --filter @cda/web build >/dev/null 2>&1 && \
  (grep -rl "sk-ant\|ANTHROPIC_API_KEY" packages/web/dist || echo "key absent from web bundle ✓")
```
