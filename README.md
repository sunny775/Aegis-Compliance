# AI-Powered Compliance Document Analyzer

> Upload Queensland coal-mining safety documents and get plain-English summaries, a grounded Q&A chat, and a **clause-level gap analysis** between a site procedure and a Recognised Standard — every AI claim traceable to a cited clause and page.

<!-- TODO: replace with a real screenshot of the gap-analysis coverage matrix -->

![Gap-analysis coverage matrix — PLACEHOLDER, replace with a real screenshot](./assets/coverage-matrix.png)

**Live demo:** `https://TODO-demo-url.example.com` &nbsp;·&nbsp; **Mock login:** `admin` / `compliance-demo`
_(Demo URL is a placeholder; credentials are configurable — see [Configuration](#configuration).)_

---

## What it does

- **Summaries** — plain-English overview of any document (map-reduce for long ones like RS17's 171 pages).
- **Key points** — structured, citable extraction of the important controls.
- **Grounded Q&A** — a streaming chat answered _only_ from retrieved passages, with inline clause/page citations that jump to the source text.
- **Gap analysis** _(the core deliverable)_ — a requirements-coverage matrix between a procedure and a standard: each requirement classified `FULL` / `PARTIAL` / `MISSING` with risk-weighted severity, standard ⇄ procedure citations, evidence, rationale, and a recommended action.

The app **seeds itself on boot** with the six supplied documents and pre-computes the showcase report (ACME Tyre, Wheel & Rim Procedure ↔ Recognised Standard 13), so it opens already populated.

---

## Quick start

### Prerequisites

- **Node.js ≥ 20** and **pnpm 10** (`npm i -g pnpm`)
- An **Anthropic API key** (`ANTHROPIC_API_KEY`)

### 1. Install

```bash
pnpm install
```

> First install compiles a native dependency (`sharp`, used by the local embedding stack). It is allow-listed in `package.json` (`pnpm.onlyBuiltDependencies`), so it builds automatically — no `pnpm approve-builds` prompt.

### 2. Configure environment

Copy the example and fill in your key. The server reads `packages/server/.env`; the web app reads `packages/web/.env`.

```bash
# Server
cp .env.example packages/server/.env   # then set ANTHROPIC_API_KEY
# Web
printf 'VITE_API_URL=http://localhost:4000\n' > packages/web/.env
```

Required server variables (see [Configuration](#configuration) for the full list):

```dotenv
ANTHROPIC_API_KEY=sk-ant-...          # required
CLAUDE_MODEL_CHEAP=claude-haiku-4-5   # optional (defaults shown)
CLAUDE_MODEL_REASONING=claude-sonnet-4-6
PORT=4000
CORS_ORIGIN=http://localhost:5173
AUTH_USERNAME=admin                   # mock login
AUTH_PASSWORD=compliance-demo
```

### 3. Run (two terminals)

```bash
pnpm dev:server   # API on http://localhost:4000 — ingests docs/ and pre-runs the Tyre↔RS13 report on boot
pnpm dev:web      # UI  on http://localhost:5173
```

Open http://localhost:5173 and sign in with the mock credentials.

> **Seeding & cost control.** On boot the server ingests the six PDFs in `docs/` (local embeddings, $0) and pre-runs the showcase gap report (a few cents on Claude). To boot fast without the pre-run during development:
>
> ```bash
> SEED_PRERUN_GAP=false pnpm dev:server
> ```

### Production build

```bash
pnpm -r build
pnpm --filter @cda/server start     # node dist/index.js
pnpm --filter @cda/web preview      # serve the built UI
```

---

## Configuration

All server config is validated at startup (the process fails fast with a clear message if `ANTHROPIC_API_KEY` is missing).

| Variable                          | Where  | Default                     | Purpose                                                           |
| --------------------------------- | ------ | --------------------------- | ----------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`               | server | — (**required**)            | Claude API key; **server-side only**, never shipped to the client |
| `CLAUDE_MODEL_CHEAP`              | server | `claude-haiku-4-5`          | Cheap tier: summaries, key points, Q&A                            |
| `CLAUDE_MODEL_REASONING`          | server | `claude-sonnet-4-6`         | Reasoning tier: requirement extraction, gap classification        |
| `PORT`                            | server | `4000`                      | API port                                                          |
| `CORS_ORIGIN`                     | server | `http://localhost:5173`     | Allowed frontend origin (CORS is locked to it)                    |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | server | `admin` / `compliance-demo` | Mock login credentials (identification only)                      |
| `DOCS_DIR`                        | server | `<repo>/docs`               | Directory of source PDFs to seed                                  |
| `SEED_PRERUN_GAP`                 | server | `true`                      | Set `false` to skip the boot-time gap pre-run                     |
| `VITE_API_URL`                    | web    | `http://localhost:4000`     | API base URL                                                      |

`.env` files are git-ignored; `.env.example` documents every variable.

---

## Architecture

A layered backend (Routes → Controllers → Zod validation → Services → provider interfaces, wired in a single composition root) and a React frontend, talking over REST + Server-Sent Events.

```
React + TS + Vite + MUI + Framer Motion + TanStack Query   (packages/web)
        │  REST + SSE
Node + TS + Express                                         (packages/server)
   HTTP layer → Services → Provider interfaces (Claude · local embeddings · vector store · parser · chunker)
                          ↳ InMemory repositories
```

**The design, and the reasoning behind every decision, lives in [ARCHITECTURE.md](./ARCHITECTURE.md).** The two sections worth reading first are _Chunking Strategy_ (§5) and _Gap Analysis Methodology_ (§7). This README intentionally does not duplicate it.

---

## AI Engineering

The guiding constraint: **every AI-generated claim must be traceable to a cited clause and page** — an uncitable answer in a compliance setting is worse than no answer. That drives the choices below.

- **Structure-aware chunking + provenance** — documents are split on their numbered clause hierarchy (`8.5`, `4.5`, `1.0`), so each chunk is a self-contained control carrying full metadata (`docId`, `clauseRef`, `sectionPath`, `headingTrail`, `page`, `charRange`). A clause that exceeds the embedding model's window is sub-split into overlapping windows that **inherit the parent clause's citation**. Unstructured PDFs fall back to a recursive paragraph→sentence chunker.
- **Sub-document / bundle handling** — `ACME-Mine.pdf` is a container of ~40 independent procedures whose numbering each resets to `1`. The parser detects sub-document boundaries (title + header block + section reset) and scopes all provenance to a `subDocId`, so two "Section 2. Scope" blocks never collide.
- **ToC → page citations** — for standards (RS13, RS17) the Table of Contents is parsed into a `clauseRef → page` map (handling both tabular and dotted-leader layouts), giving accurate page numbers with no brittle inference (`RS13 §4.5 → p.23`).
- **RAG retrieval** — metadata-filtered semantic search: chunks are embedded once at ingestion; a query is embedded with the _same_ model and ranked by cosine similarity, **scoped by a metadata filter** (Q&A → the active `docId`; gap analysis → `docType: "procedure"` + the procedure's id). The same retrieval primitive serves Q&A and gap analysis.
- **Gap-analysis methodology** — a **requirements-coverage matrix**, not one giant prompt: (1) extract atomic requirements from the standard, per-section so it scales; (2) for each requirement, retrieve the top-k relevant _procedure_ chunks; (3) classify coverage against **that evidence only** (`MISSING` by default, no outside knowledge, severity = safety risk); (4) aggregate into a cached report. N small, citable, parallelizable judgments instead of one unscalable call.
- **Model routing (Haiku ↔ Sonnet)** — services request a _capability tier_; a model router maps it to a model from config. Haiku for high-volume work (summaries, key points, Q&A); Sonnet only where reasoning changes the outcome (extraction, classification).
- **Tool-use structured output + Zod guard** — structured results are forced via Claude tool use (the tool's `input_schema` _is_ the JSON schema), then **re-validated with Zod** at the adapter boundary, throwing a typed error on mismatch. No fragile free-text parsing. Citations are grounded defensively: the standard citation comes from the requirement, and the procedure citation is derived from the retrieved passage the model points at — never invented.
- **Prompt caching** — the large, stable gap-classification rubric is marked `cache_control: ephemeral`, so across dozens of per-requirement calls the shared prefix bills at a fraction of input cost. This is the dominant cost lever.
- **Temperature choices** — `0` for extraction, gap classification, and Q&A grounding (determinism + faithfulness); `~0.3` only for the plain-English summary (a little fluency aids readability); `~0.1` for key-point extraction.
- **Local embeddings ($0)** — Claude has no first-party embedding model, so embeddings run locally and in-process via `@xenova/transformers` (`all-MiniLM-L6-v2`): no second paid API, no extra key, deterministic. Retrieval quality here is dominated by chunk structure and metadata filtering, so the budget is reserved for reasoning.
- **Result caching** — summaries, key points, and gap reports are cached in the repository (keyed by content hash / document+procedure+hash). Re-opening a document or re-viewing a report never re-bills the model.
- **The under-$20 story** — Haiku for volume, Sonnet only for reasoning, a prompt-cached classification prefix, free local embeddings, and cached results mean end-to-end processing of the full corpus — including the pre-computed Tyre↔RS13 report — costs on the order of **cents**, comfortably inside the **$20** cap with room for interactive use.

---

## Testing

The brief asks for **selected, valuable tests, not 100% coverage.** The suite (Vitest) targets the logic where bugs would be most damaging and least visible; all LLM and embedding calls are **mocked**, so it is fast, deterministic, and free.

| Test                                      | Why it matters                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `structureAwareChunker`                   | A numbered clause stays intact in one chunk and `clauseRef` / `page` / `sectionPath` populate correctly — citations depend on it              |
| `subDocuments`                            | An ACME-Mine-style bundle splits into the right sub-documents with distinct `subDocId`s and **no clause-ref collisions**                      |
| `tableOfContents`                         | ToC → page parsing for both RS13 (tabular) and RS17 (dotted-leader) layouts                                                                   |
| `inMemoryVectorStore`                     | Cosine ranking order is correct **and** metadata filters exclude non-matching chunks                                                          |
| `structuredOutput` / `claudeLLMProvider`  | The Zod guard rejects malformed tool output; tier routing, forced tool use, prompt-cache marker, and streaming all behave                     |
| `summaryService`                          | A second summarize/extract call is served from cache without re-invoking the model; map-reduce fans out correctly                             |
| `qaService`                               | Retrieved context is actually passed into the grounded prompt and citations are returned; declines with no model call when retrieval is empty |
| `gapAnalysisService`                      | `MISSING` is returned when no evidence is retrieved (faithfulness guard); coverage score and counts aggregate correctly                       |
| `ingestionService` / `config` / `httpApi` | Ingestion orchestration + batching; fail-fast config; HTTP validation / auth / error-contract                                                 |

```bash
pnpm -r test
```

---

## Trade-offs & next steps

Mirrors [ARCHITECTURE.md §13](./ARCHITECTURE.md):

- **In-memory storage** is intentional for a frictionless demo. The `DocumentRepository` / `VectorStore` interfaces make a **SQLite or Postgres + pgvector** swap a contained change.
- **Gap-analysis accuracy is judged qualitatively.** The most valuable next step is an **evaluation harness** — a small labelled set of known gaps for the Tyre↔RS13 pair, scored for precision/recall — turning prompt iteration into a measurable process.
- **Parsing is text-only.** Tables, figures, and appendix matrices would benefit from **table-aware extraction**.
- **Retrieval** could add a re-ranking pass or hybrid lexical+semantic search for very large standards like RS17.
- **Auth, multi-tenancy, and audit logging** are mocked/out of scope and would be required for production.

---

## Project layout

```
packages/
  server/   Node + TS + Express API (parsing, chunking, RAG, gap analysis, seed)
  web/      React + TS + Vite + MUI + Framer Motion UI
docs/       The six source PDFs (two ACME procedures, four Recognised Standards)
ARCHITECTURE.md   Design & decision record (source of truth)
```

## Scripts (from the repo root)

| Command                            | Action                             |
| ---------------------------------- | ---------------------------------- |
| `pnpm install`                     | Install all workspaces             |
| `pnpm dev:server` / `pnpm dev:web` | Run API / UI in watch mode         |
| `pnpm -r build`                    | Type-check and build both packages |
| `pnpm -r test`                     | Run the test suites                |
| `pnpm lint`                        | Lint the whole repo                |
