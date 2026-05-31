# Architecture & Design

**AI-Powered Compliance Document Analyzer**

This document explains how the system is structured, the engineering decisions behind it, and—most importantly—*why* each decision was made. The two sections reviewers should read first are **[Chunking Strategy](#5-chunking-strategy)** and **[Gap Analysis Methodology](#7-gap-analysis-methodology)**, since those carry the bulk of the domain reasoning.

---

## 1. Problem framing

Compliance teams in regulated industries (here: Queensland coal mining) maintain two kinds of documents that must stay in agreement:

- **Recognised Standards** — the reference controls (e.g. *Recognised Standard 13 — Tyre, Wheel and Rim Management*, a 48-page Queensland RHSQ document with a formal clause hierarchy).
- **Site Procedures** — how a specific operation implements those controls (e.g. *ACME Mine Tyre, Wheel and Rim Management Procedure*, which explicitly references RS13).

The recurring questions are: *what does this document actually say, can I ask it specific questions, and where does our procedure fall short of the standard?* The system answers all three: plain-English summaries, key-point extraction, a grounded Q&A chat, and—the core deliverable—a **clause-level gap analysis** between a procedure and a standard.

A design principle runs through everything below: **every AI-generated claim must be traceable to a cited clause and page.** In a compliance setting an uncitable answer is worse than no answer, because it cannot be audited. This single constraint drives the chunking strategy, the metadata model, the retrieval design, and the gap-analysis output schema.

### 1.1 Domain nuance that shaped the design

Recognised standards are explicitly **not mandatory**; RS13 states that following the standard provides *a way* of meeting the statutory safety obligation, and that a site adopting a different method may be required to demonstrate it is *equivalent*. The system therefore does not frame gaps as binary "violations." It frames them as **coverage** of recognised controls, with **severity weighted by safety risk** rather than by mere absence of matching text. A missing exclusion-zone control around tyre inflation is `Critical`; a missing documentation-retention detail is `Low`. This framing is reflected directly in the gap-analysis output.

---

## 2. The document corpus (and what it taught us)

The design was built against the actual supplied documents, not a generic assumption about PDFs.

| Document | Role | Pages | Structural characteristics |
|---|---|---:|---|
| ACME Tyre, Wheel & Rim Management Procedure | Procedure | 6 | Clean numbered sections `1`–`11` + appendices; document ID `ACME-SHMS-PLT-PR-013`; **explicitly references RS13** |
| ACME-Mine.pdf | Procedure **bundle** | 42 | A *container* of many independent sub-documents (e.g. *793F Dumping SWI*, *Alcohol & Drug Testing Procedure*), each with its **own** `1. Purpose / 2. Scope …` numbering that resets |
| Recognised Standard 13 (tyre/wheel/rim) | Standard | 48 | Hierarchical ToC (`1.0`, `3.1`, `4.1` … with page numbers); `must`/`shall`/`should` requirement language; the natural match for the ACME tyre procedure |
| Recognised Standard 03 | Standard | 7 | Explosion-protected diesel engines |
| Recognised Standard 08 | Standard | 26 | Conduct of mine emergency exercises |
| Recognised Standard 17 | Standard | 171 | Hazardous chemicals — the **scale stress-test** |

Three observations changed the architecture:

1. **A genuine matched pair exists** (ACME Tyre Procedure ↔ RS13), cross-referenced in the source text. This is the default gap-analysis showcase and is pre-computed at seed time.
2. **`ACME-Mine.pdf` is not one document.** Treating it as one would make clause references collide across unrelated sub-documents (two different "Section 2. Scope" blocks). The parser performs **sub-document boundary detection** and scopes all provenance to a `subDocId`.
3. **The standards carry a machine-readable Table of Contents** mapping every section to a page. Parsing it yields a reliable `section → page` map, so citations show correct page numbers without brittle inference.

All six PDFs have real embedded text layers, so no OCR is required; extraction is text-based with page tracking.

---

## 3. System overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  FRONTEND — React + TypeScript + Material UI + Vite + Framer Motion    │
│                                                                        │
│   Login(mock) · Dashboard · Upload · DocumentDetail · GapAnalysis      │
│   typed API client · React Query · SSE streaming Q&A · citation jumps  │
└───────────────────────────────────┬──────────────────────────────────┘
                                     │  REST + Server-Sent Events
┌───────────────────────────────────┴──────────────────────────────────┐
│  BACKEND — Node + TypeScript + Express                                 │
│                                                                        │
│   HTTP layer        Routes → Controllers → (Zod validation) → Services │
│                                                                        │
│   Services          DocumentService    IngestionService                │
│                     SummaryService     QAService (RAG)                 │
│                     GapAnalysisService                                 │
│                                                                        │
│   Providers (interfaces)        Repositories                           │
│     LLMProvider ───── Claude      DocumentRepository ── InMemory impl   │
│     EmbeddingProvider ─ local     VectorStore ───────── InMemory impl   │
│     DocumentParser ── PDF+bundle                                       │
│     Chunker (Strategy) ─ structure-aware / recursive                   │
│                                                                        │
│   Cross-cutting     config · model router · error middleware · logger  │
│                     composition root (dependency wiring)               │
└────────────────────────────────────────────────────────────────────────┘
```

The backend is a **layered architecture**. HTTP concerns (routing, request validation, error shaping) never mix with business logic, and business logic never imports a vendor SDK directly—it depends on **provider interfaces** that are implemented by thin adapters and wired together in a single composition root. This is what keeps the system testable (mock the interface) and swappable (replace the adapter).

---

## 4. Component responsibilities

### 4.1 HTTP layer
Thin controllers translate HTTP ↔ domain calls. Every request body is validated with **Zod** at the boundary; a controller never receives unvalidated input. A centralized error middleware maps typed domain errors to consistent JSON responses (`{ error: { code, message } }`), so the frontend has a single error contract.

### 4.2 Services (business logic)
Each service has one responsibility and depends only on interfaces:

- **IngestionService** — orchestrates parse → sub-document detection → chunk → embed → index → persist.
- **DocumentService** — read model for the dashboard/detail views; owns summary/key-point retrieval and caching.
- **SummaryService** — plain-English summary and structured key points.
- **QAService** — retrieval-augmented question answering with citations and streaming.
- **GapAnalysisService** — the requirements-coverage-matrix engine.

### 4.3 Providers (interfaces + adapters)
- **`LLMProvider`** — `complete()` (with optional JSON-schema/tool mode) and a streaming variant. Implemented by `ClaudeLLMProvider`.
- **`EmbeddingProvider`** — `embed(texts) → number[][]`. Implemented locally (see §8).
- **`VectorStore`** — `add()` / `search(queryEmbedding, k, filter)`; `InMemoryVectorStore` uses cosine similarity with metadata filtering.
- **`DocumentParser`** — text + page extraction, ToC parsing, sub-document detection.
- **`Chunker`** — the Strategy interface (see §5).

### 4.4 Repositories
- **`DocumentRepository`** — documents, chunk metadata, cached analyses. `InMemoryDocumentRepository` for the demo; the interface makes a SQLite/Postgres swap a one-file change.

---

## 5. Chunking Strategy

> The task explicitly asks the candidate to explain the chunking strategy and why it was chosen. This section is the answer.

### 5.1 Why fixed-size chunking is the wrong default here

The reflexive approach—split every document into ~1,000-character windows with ~200-character overlap—fails compliance documents in three specific ways:

1. **It severs requirements mid-thought.** A clause such as RS13 §4.5 or the procedure's `8.5 Inflation & Pressure Control` is a self-contained control. A blind window will cut it in half, so retrieval returns a fragment that can neither be understood nor cited cleanly.
2. **It destroys provenance.** Citations must be *clause-level* (`§4.5, p.23`). A character offset carries no clause or page identity, so you cannot tell the user—or the auditor—where an answer came from.
3. **It corrupts the bundle.** In `ACME-Mine.pdf`, fixed windows freely span two unrelated sub-documents, mixing the *Dumping* procedure with the *Alcohol & Drug Testing* procedure in one chunk.

### 5.2 The chosen strategy: structure-aware chunking with provenance

These documents are **hierarchically structured**, and that structure is visible in the text. The chunker exploits it:

1. **Detect the document's section hierarchy** from numbered headings—`8`, `8.5`, `8.5.1` in procedures; `1.0`, `3.1`, `4.5` in standards—plus the heading text.
2. **Chunk on structural boundaries**, so each chunk is one coherent clause/sub-clause. A control stays intact.
3. **Attach rich metadata to every chunk** (the heart of the design):

```ts
interface ChunkMetadata {
  docId: string;
  docType: "standard" | "procedure";
  subDocId?: string;          // present for ACME-Mine.pdf sub-documents
  sectionPath: string[];      // ["4", "4.5"]  — full hierarchy
  clauseRef: string;          // "4.5"
  headingTrail: string;       // "Technical Guidance > Maintenance and Upkeep"
  page: number;               // from the ToC map / page tracking
  charRange: [number, number];
}
```

4. **Token-ceiling fallback.** If a single structural unit exceeds the embedding model's comfortable input size, it is sub-split into overlapping windows that *inherit the parent clause's metadata*, so even a split chunk remains citable as `§4.5`.
5. **Unstructured fallback.** If a PDF has no detectable hierarchy, the chunker degrades to a `RecursiveChunker` (paragraph → sentence) so the system never fails closed.

### 5.3 Sub-document detection (the bundle case)

`ACME-Mine.pdf` is segmented before chunking. A new sub-document boundary is detected where a title line is followed by a header block (`Document Title: … Document Type: … Effective Date: …`) and section numbering resets to `1`. Each sub-document receives its own `subDocId`, and all downstream clause references and citations are scoped to it. Two procedures can now both contain a "Section 2. Scope" without their chunks ever being confused.

### 5.4 Table-of-Contents → page mapping

For standards (RS13, RS17) the ToC lists each section with its page (`4.5 Maintenance and Upkeep … 23`). The parser reads this into a `Map<clauseRef, page>`. Combined with page-tracked extraction, this gives every chunk an accurate page number—so a citation reads `RS13 §4.5, p.23` and the user can verify it in seconds.

### 5.5 Why this is the right trade-off

Structure-aware chunking costs more parsing effort than fixed windows, and it relies on the document being reasonably structured (mitigated by the recursive fallback). In exchange it delivers exactly what compliance work demands: **semantically intact, independently citable units**, scoped correctly even inside a bundle. Retrieval precision improves because a query about inflation safety matches the whole `8.5` control rather than a fragment, and—critically—the gap-analysis citations become trustworthy. For this domain that trade is clearly worth it.

---

## 6. Retrieval design (RAG)

Retrieval is **metadata-filtered semantic search**, not just nearest-neighbor over a flat index:

- Chunks are embedded once at ingestion and stored in the `VectorStore` with their full metadata.
- A query is embedded with the **same** model and compared by cosine similarity.
- Every search is **scoped by a metadata filter**: Q&A filters to the active `docId`; gap analysis filters to `docType: "procedure"` and the specific `procedureDocId` (and respects `subDocId`). This prevents cross-document contamination and is only possible because chunks carry structured metadata.
- Top-_k_ chunks (with their citations) are passed to the LLM as the *only* permitted evidence.

The same retrieval primitive serves both Q&A (query = user question) and gap analysis (query = a single extracted requirement), which keeps the surface area small and well-tested.

---

## 7. Gap Analysis Methodology

> This is the system's core value and its primary differentiator. The design mirrors how a human compliance auditor actually works.

### 7.1 Why not "put both documents in one prompt"

The naive approach—paste the standard and the procedure into one giant prompt and ask for the gaps—was rejected because it is **uncitable** (the model invents loose summaries with no clause anchors), **non-deterministic** (small prompt changes reshuffle the findings), and **unscalable** (it cannot fit RS17's 171 pages, and even when it fits, attention over a huge context degrades). It produces a demo, not an auditable tool.

### 7.2 The chosen approach: a requirements-coverage matrix

Gap analysis is decomposed into many small, focused, citable judgments:

```
Standard (reference)                         Procedure (under review)
        │                                              │
        ▼                                              │
 1. Extract discrete requirements                      │
    {id, text, clauseRef, page, category}              │
        │                                              │
        ▼                                              ▼
 2. For each requirement:  embed it ──► retrieve top-k relevant
                                        PROCEDURE chunks (filtered)
        │                                              │
        └──────────────┬───────────────────────────────┘
                       ▼
 3. Classify THIS requirement against THE RETRIEVED EVIDENCE ONLY:
        { status: FULL | PARTIAL | MISSING,
          severity: Critical | High | Medium | Low,
          standardCitation:  { clauseRef, page },
          procedureCitation: { clauseRef, page } | null,
          evidenceQuote, rationale, recommendedAction }
                       │
                       ▼
 4. Aggregate → GapReport { coverageScore, counts, matrix[] }
```

**Step 1 — Requirement extraction.** The standard is processed section-by-section (so it scales regardless of length) by the reasoning model, which extracts discrete, atomic requirements—the `must`/`shall`/`should` controls—each tagged with its originating `clauseRef`, `page`, and a `category`.

**Step 2 — Targeted retrieval.** Each requirement becomes a retrieval query against the *procedure's* index. Instead of asking the model to find a needle in the whole procedure, we hand it only the few chunks most likely to contain the answer.

**Step 3 — Constrained classification.** For each requirement, the model issues a verdict based **solely on the retrieved procedure evidence**. The prompt is explicit: if no relevant evidence was retrieved, the verdict is `MISSING`; the model may not rely on outside knowledge; severity reflects **safety risk**, not textual absence. Output is forced through a JSON schema (see §8.2) so it is always structured and citable.

**Step 4 — Aggregation.** Verdicts roll up into a `GapReport` with a coverage score (counts of `FULL`/`PARTIAL`/`MISSING` and a percentage) and the full matrix for the UI.

### 7.3 Why this wins on every axis the rubric names

- **Auditable** — every verdict cites a standard clause and (when present) a procedure clause, both with pages.
- **Scalable** — N small calls instead of one unbounded one; cost grows linearly with the number of requirements, not quadratically with document size. This is the direct answer to "how does it handle RS17?"
- **Faithful** — temperature 0, evidence-only prompting, `MISSING`-by-default, schema-validated output.
- **Domain-accurate** — coverage/equivalence framing with risk-weighted severity, matching how recognised standards actually operate.

### 7.4 Performance

Per-requirement classifications are independent and run with a **bounded concurrency limit** (rate-limit friendly, fast). The stable instruction/rubric prefix is **prompt-cached** (§8.3), so the repeated portion of each call bills at a fraction of normal input cost. Completed reports are cached by `(standardDocId, procedureDocId, contentHash)`.

---

## 8. AI Engineering & Cost

The LLM is Anthropic **Claude** (API key provided, **$20 cap**). For this corpus the real spend is a few cents; the cap is best read as a test of cost *judgment*, and the design demonstrates it deliberately.

### 8.1 Model routing (cascade)

Services request a *capability tier*, never a hard-coded model; the **model router** maps tiers to models from config:

| Tier | Model | Used for | Rate (per 1M in/out) |
|---|---|---|---|
| `cheap` | `claude-haiku-4-5` | summaries, key points, Q&A answers | $1 / $5 |
| `reasoning` | `claude-sonnet-4-6` | requirement extraction, gap classification | $3 / $15 |

The expensive model is spent only where reasoning quality changes the outcome. Everything high-volume runs on Haiku.

### 8.2 Structured output via tool use

Claude's idiomatic way to guarantee structured output is **tool use**: a tool is defined whose `input_schema` *is* the desired JSON schema, and the call forces it.

```ts
const response = await client.messages.create({
  model,
  max_tokens,
  temperature: 0,
  tools: [{ name: "record_gap_verdict", input_schema: gapVerdictJsonSchema }],
  tool_choice: { type: "tool", name: "record_gap_verdict" },
  messages,
});
// the verdict is the tool_use block's `input`, already schema-shaped
```

The returned object is then re-validated with **Zod** as a defensive guard, throwing a typed error on any mismatch. This eliminates fragile free-text parsing entirely.

### 8.3 Prompt caching — the primary cost lever

The gap engine issues one classification call per requirement, and every call shares a large, identical prefix: the system instructions, the classification rubric, and few-shot examples. That prefix is marked with `cache_control: { type: "ephemeral" }`, so after the first call the cached portion bills at roughly a tenth of standard input cost. Across dozens of requirements this is the dominant saving and the single most impactful Claude-specific optimization in the system.

### 8.4 Parameters

- **`temperature: 0`** for requirement extraction, gap classification, and Q&A grounding — determinism and faithfulness matter more than variety.
- **`temperature ≈ 0.3`** only for the plain-English summary, where a little fluency helps readability.
- **`max_tokens`** sized to each task to avoid paying for unused headroom.
- **Streaming** for Q&A, so the chat surfaces tokens as they arrive.

### 8.5 Embeddings: a deliberate local choice

Claude has **no first-party embedding model**. Rather than introduce a second paid API, embeddings run **locally and in-process** via `@xenova/transformers` (`all-MiniLM-L6-v2`): **$0**, no extra key, no network dependency, deterministic. The rationale is principled, not merely thrifty—retrieval quality here is dominated by chunk structure and metadata filtering, not by frontier-grade embeddings, so the entire budget is reserved for the reasoning that actually benefits from it.

### 8.6 Result caching

Summaries, key points, and gap reports are cached in the repository keyed by content hash. Re-opening a document or re-viewing a report never re-bills the model.

### 8.7 Net cost

With Haiku for high-volume work, Sonnet only for reasoning, a cached classification prefix, free local embeddings, and cached results, end-to-end processing of the full supplied corpus—including the pre-computed Tyre↔RS13 report—costs on the order of cents, comfortably inside the cap with room for interactive use.

---

## 9. Object-oriented design

The graded OO principles appear as concrete, named patterns:

- **Strategy** — `Chunker` is an interface with `StructureAwareChunker` (default) and `RecursiveChunker` (fallback). The ingestion pipeline selects a strategy without knowing its internals.
- **Dependency Inversion** — services depend on `LLMProvider`, `EmbeddingProvider`, `VectorStore`, `DocumentParser`, and `Chunker` *abstractions*. Concrete adapters (Claude, local embeddings, in-memory store) are constructed once in the composition root and injected. No service imports a vendor SDK.
- **Repository** — persistence sits behind `DocumentRepository`/`VectorStore` interfaces, so storage can move from in-memory to SQLite/pgvector without touching business logic.
- **Single Responsibility** — parsing, sub-document detection, chunking, embedding, retrieval, summarization, Q&A, requirement extraction, and gap classification are each isolated units, which is also what makes them cheap to unit-test.
- **Encapsulated domain types / DTOs** — Claude SDK response shapes are mapped to the system's own domain types at the adapter boundary and never leak into the HTTP API.

---

## 10. Domain model (selected types)

```ts
type DocType = "standard" | "procedure";

interface DocumentRecord {
  id: string;
  title: string;
  docType: DocType;
  pageCount: number;
  sizeBytes: number;
  contentHash: string;
  subDocuments?: SubDocument[];   // populated for bundles
  summary?: string;               // cached
  keyPoints?: KeyPoint[];         // cached
}

interface Requirement {
  id: string;
  text: string;
  clauseRef: string;
  page: number;
  category: string;
}

type GapStatus = "FULL" | "PARTIAL" | "MISSING";
type Severity = "Critical" | "High" | "Medium" | "Low";

interface GapVerdict {
  requirement: Requirement;
  status: GapStatus;
  severity: Severity;
  standardCitation: { clauseRef: string; page: number };
  procedureCitation: { clauseRef: string; page: number } | null;
  evidenceQuote: string;
  rationale: string;
  recommendedAction: string;
}

interface GapReport {
  standardDocId: string;
  procedureDocId: string;
  coverageScore: number;                          // % of requirements FULL
  counts: Record<GapStatus, number>;
  matrix: GapVerdict[];
}
```

---

## 11. Testing strategy

The brief asks for **selected, valuable tests, not 100% coverage.** The chosen tests target the logic where bugs would be most damaging and least visible:

1. **`StructureAwareChunker` provenance** — a numbered clause stays intact in one chunk, and `clauseRef`/`page`/`sectionPath` populate correctly.
2. **Bundle splitting** — `ACME-Mine.pdf`-style input splits into the correct sub-documents with distinct `subDocId`s.
3. **`InMemoryVectorStore`** — cosine ranking returns nearest chunks in order and honors metadata filters.
4. **Structured-output guard** — the Zod validator rejects malformed/again-hallucinated LLM output.
5. **QA grounding** — retrieved context is actually passed into the prompt and citations are returned (LLM + retrieval mocked).
6. **Gap classification rule** — `MISSING` is returned when retrieval yields no relevant evidence.
7. **Gap aggregation** — coverage score and `FULL/PARTIAL/MISSING` counts are computed correctly over a fixture set.

LLM and embedding calls are mocked, so the suite is fast, deterministic, and free to run.

---

## 12. Security & operational notes

- The **Claude API key lives only on the server**, read from environment, never shipped to the client. `.env` is gitignored; `.env.example` documents the required variables.
- **CORS** is locked to the frontend origin.
- Authentication is **mocked** per the brief (hardcoded credentials used only for user identification); the seam is a real service, so swapping in genuine auth is localized.
- Uploads are validated (type/size) and parsed defensively.

---

## 13. Trade-offs & future work

Honest limitations and the path beyond them:

- **In-memory storage** is intentional for a frictionless demo. The Repository/VectorStore interfaces make **SQLite or Postgres + pgvector** a contained change.
- **Gap-analysis accuracy is currently judged qualitatively.** The most valuable next step is an **evaluation harness**: a small labelled set of known gaps for the Tyre↔RS13 pair, scored for precision/recall, turning prompt iteration into a measurable process.
- **Parsing is text-only.** Tables, figures, and appendix matrices (e.g. RS13's nomenclature appendix) would benefit from **table-aware extraction**.
- **Retrieval** could add a re-ranking pass or hybrid lexical+semantic search for very large standards like RS17.
- **Auth, multi-tenancy, and audit logging** would be required for production but are out of scope for the exercise.

---

## 14. Decision summary

| Decision | Why |
|---|---|
| Structure-aware chunking + provenance metadata | Keeps controls intact and makes every chunk independently citable, which the gap citations depend on |
| Sub-document detection for bundles | Prevents clause-reference collisions inside `ACME-Mine.pdf` |
| ToC → page mapping | Accurate page citations with no brittle inference |
| Requirements-coverage-matrix gap analysis | Auditable, scalable, faithful, and domain-accurate—unlike a single all-in-one prompt |
| Evidence-only classification, temperature 0, `MISSING`-by-default | Prevents hallucinated compliance verdicts |
| Risk-weighted severity, coverage/equivalence framing | Matches how recognised standards actually operate |
| Claude tier routing (Haiku ↔ Sonnet) | Spends the expensive model only where reasoning changes the outcome |
| Tool-use structured output + Zod guard | Guaranteed, validated JSON instead of fragile parsing |
| Prompt caching of the classification prefix | The dominant cost saving across per-requirement calls |
| Local `$0` embeddings | No second API; budget reserved for reasoning |
| Provider interfaces + composition root | Testable, swappable, vendor-agnostic core |
