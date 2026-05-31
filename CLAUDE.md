# CLAUDE.md

Guidance for Claude Code (and any future session) working in this repository.

## What this is

A take-home tech test: an **AI-Powered Compliance Document Analyzer**. Users upload
compliance documents (Queensland coal-mining procedures and Recognised Standards),
get plain-English summaries, key points, a grounded Q&A chat, and — the core
deliverable — a **clause-level gap analysis** between a site procedure and a standard.

The task specification is `spec.docx`. The six source PDFs are in `docs/`.

## Source of truth

**`ARCHITECTURE.md` is the design source of truth. Implement against it; do not
rewrite or regenerate it.** It carries the domain reasoning the test is graded on
(chunking strategy §5, gap-analysis methodology §7). Any code decision should trace
back to a section there. If the code and `ARCHITECTURE.md` ever disagree, the
architecture wins unless the user says otherwise.

## Fixed stack (do not substitute)

**Backend** — Node.js + TypeScript + Express
- Layered: Routes → Controllers → (Zod validation) → Services → Provider interfaces
- Provider interfaces with thin adapters, wired in a single composition root
  (`LLMProvider`, `EmbeddingProvider`, `VectorStore`, `DocumentParser`, `Chunker`)
- **In-memory storage** behind `DocumentRepository` / `VectorStore` interfaces
- PDF parsing with page tracking + sub-document detection + ToC→page mapping

**Frontend** — React + TypeScript + **Vite**
- **Material UI** for components (use the `mui-mcp` tools for MUI API/docs — it is
  active in this project; pull `useMuiDocs` then `fetchDocs` rather than relying on memory)
- **Framer Motion** for animation
- **TanStack Query** (React Query) for server state
- Typed API client; SSE streaming for Q&A; citation jump-to-clause
- Mocked login (hardcoded credentials, identification only)

**AI / Claude API**
- Anthropic Claude via the official SDK, **API key server-side only** (env, never shipped)
- **Model routing by capability tier** (from config, never hard-coded models):
  - `cheap` → `claude-haiku-4-5` — summaries, key points, Q&A answers
  - `reasoning` → `claude-sonnet-4-6` — requirement extraction, gap classification
- **Structured output via tool use** (`input_schema` = desired JSON schema,
  `tool_choice` forced), re-validated with **Zod** at the adapter boundary
- **Prompt caching** (`cache_control: ephemeral`) on the stable gap-classification prefix
- `temperature: 0` for extraction / classification / Q&A grounding; `~0.3` only for summaries
- Use the `claude-api` skill when adding or tuning Claude features

**Embeddings** — local, in-process, **$0**
- `@xenova/transformers` with `all-MiniLM-L6-v2`. No second paid API, no extra key.

## Budget

**Hard cap: $20 of Claude usage.** Real expected spend on this corpus is cents — the
cap is a test of cost *judgment*. Honour the routing/caching/local-embeddings design
above; don't reach for the reasoning model where the cheap tier suffices, and don't
re-bill cached work (summaries, key points, gap reports are cached by content hash).

## The corpus (verified against the files)

| File | Role | Pages | Notes |
|---|---|---:|---|
| `ACME Mine Tyre, Wheel And Rim Management Procedure.pdf` | Procedure | 6 | Clean numbered sections **1–19** + appendices A–D; ID `ACME-SHMS-PLT-PR-013`; references RS13 |
| `ACME-Mine.pdf` | Procedure **bundle** | 42 | ~40 independent sub-documents, each resetting to `1.`; needs sub-document boundary detection |
| `recognised-standard-13 (tyre_wheel_rim).pdf` | Standard | 48 | Hierarchical ToC w/ pages (`4.5 … 23`); matched pair for the ACME tyre procedure |
| `recognised-standard-03.pdf` | Standard | 7 | Explosion-protected diesel engines |
| `recognised-standard-08.pdf` | Standard | 26 | Conduct of mine emergency exercises |
| `recognised-standard-17.pdf` | Standard | 171 | Hazardous chemicals — scale stress-test; dotted-leader ToC |

All six PDFs have embedded text layers — **no OCR required**. Compliance/gap checks
are between **ACME procedures and Recognised Standards** (the showcase pair is the
ACME Tyre Procedure ↔ RS13).

> Two corrections to `ARCHITECTURE.md` surfaced during file verification (see the
> session notes): the ACME tyre procedure runs sections **1–19** (not 1–11), and the
> matched pair is cross-referenced **one-directionally** (the ACME procedure cites
> RS13; RS13, a generic 2024 standard, does not cite ACME). Implement to the files.

## Graded on

Full-stack architecture · OO design principles · code quality · UI design ·
selected valuable unit tests · GenAI API efficiency (prompt quality + parameters) ·
RAG design and AI engineering. Deliverable is a GitHub repo with a README containing
full setup instructions.

## Working conventions

- Don't commit or push unless asked. `.env` stays gitignored; ship a `.env.example`.
- Tests mock LLM + embedding calls — the suite must stay fast, deterministic, free.
- When unsure about an MUI API, query `mui-mcp`; when unsure about a Claude feature,
  use the `claude-api` skill. Don't guess versioned APIs from memory.
