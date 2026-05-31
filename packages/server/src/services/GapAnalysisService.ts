import { createHash } from 'crypto';
import type {
  Chunk,
  Citation,
  GapReport,
  GapStatus,
  GapVerdict,
  Requirement,
} from '../domain/types';
import type { LLMProvider } from '../providers/LLMProvider';
import type { EmbeddingProvider } from '../providers/EmbeddingProvider';
import type { VectorStore } from '../providers/VectorStore';
import type { DocumentRepository } from '../repositories/DocumentRepository';
import { validateStructured } from '../providers/structuredOutput';
import { NotFoundError } from '../http/errors';
import {
  REQUIREMENT_EXTRACTION_SYSTEM,
  requirementsJsonSchema,
  requirementsResultSchema,
  REQUIREMENTS_TOOL_NAME,
  REQUIREMENTS_TOOL_DESCRIPTION,
  GAP_CLASSIFICATION_SYSTEM,
  gapVerdictJsonSchema,
  gapVerdictResultSchema,
  GAP_VERDICT_TOOL_NAME,
  GAP_VERDICT_TOOL_DESCRIPTION,
  buildExtractionUserMessage,
  buildClassificationUserMessage,
  type GapEvidencePassage,
} from '../prompts/gapPrompts';

/**
 * GapAnalysisService (ARCHITECTURE.md §7) — the requirements-coverage-matrix
 * engine. Decomposes gap analysis into many small, focused, citable judgments:
 *   1. extract discrete requirements from the standard, per section (scales);
 *   2. for each requirement, retrieve the most relevant procedure chunks;
 *   3. classify coverage against THAT evidence only (MISSING by default);
 *   4. aggregate into a GapReport, cached by (standard, procedure, contentHash).
 * Reasoning tier (Sonnet), temperature 0, tool-use JSON, with the stable rubric
 * prompt-cached across calls. Per-requirement calls run at bounded concurrency.
 */

export interface ProcedurePassage extends GapEvidencePassage {
  subDocId?: string;
}

export interface GapAnalysisOptions {
  /** Top-k procedure chunks retrieved per requirement. */
  topK?: number;
  /** Max characters per requirement-extraction section batch. */
  sectionChars?: number;
  /** Concurrent per-requirement classifications. */
  concurrency?: number;
}

export interface GapAnalysisDeps {
  llm: LLMProvider;
  embeddings: EmbeddingProvider;
  vectorStore: VectorStore;
  repository: DocumentRepository;
  options?: GapAnalysisOptions;
}

const REASONING = 'reasoning' as const;

export class GapAnalysisService {
  private readonly llm: LLMProvider;
  private readonly embeddings: EmbeddingProvider;
  private readonly vectorStore: VectorStore;
  private readonly repository: DocumentRepository;
  private readonly topK: number;
  private readonly sectionChars: number;
  private readonly concurrency: number;

  constructor(deps: GapAnalysisDeps) {
    this.llm = deps.llm;
    this.embeddings = deps.embeddings;
    this.vectorStore = deps.vectorStore;
    this.repository = deps.repository;
    this.topK = deps.options?.topK ?? 6;
    this.sectionChars = deps.options?.sectionChars ?? 6_000;
    this.concurrency = deps.options?.concurrency ?? 5;
  }

  /** Full pipeline: extract → retrieve → classify → aggregate, with caching. */
  async analyze(standardDocId: string, procedureDocId: string): Promise<GapReport> {
    const standard = await this.repository.getById(standardDocId);
    if (!standard) throw new NotFoundError(`Standard not found: ${standardDocId}`);
    const procedure = await this.repository.getById(procedureDocId);
    if (!procedure) throw new NotFoundError(`Procedure not found: ${procedureDocId}`);

    const contentHash = combinedHash(standard.contentHash, procedure.contentHash);
    const cached = await this.repository.getGapReport(standardDocId, procedureDocId, contentHash);
    if (cached) return cached; // §8.6 — never re-bill a completed report

    const requirements = await this.extractRequirements(standardDocId);
    const verdicts = await mapWithConcurrency(requirements, this.concurrency, async (req) => {
      const passages = await this.retrieveProcedure(req, procedureDocId);
      return this.classifyCoverage(req, passages);
    });

    const report = aggregateReport(standardDocId, procedureDocId, verdicts);
    await this.repository.saveGapReport(report, contentHash);
    return report;
  }

  /** Step 1 — extract discrete requirements from the standard, per section. */
  async extractRequirements(standardDocId: string): Promise<Requirement[]> {
    const record = await this.repository.getById(standardDocId);
    if (!record) throw new NotFoundError(`Standard not found: ${standardDocId}`);

    const sections = groupSections(await this.repository.getChunks(standardDocId), this.sectionChars);
    const perSection = await mapWithConcurrency(sections, this.concurrency, (sectionText) =>
      this.extractFromSection(record.title, sectionText),
    );

    let n = 0;
    return perSection.flat().map((r) => ({ id: `req-${++n}`, ...r }));
  }

  /** Step 3 — classify one requirement against ONLY the retrieved evidence. */
  async classifyCoverage(
    requirement: Requirement,
    passages: ProcedurePassage[],
  ): Promise<GapVerdict> {
    const completion = await this.llm.complete(
      [{ role: 'user', content: buildClassificationUserMessage(requirement, passages) }],
      {
        model: REASONING,
        maxTokens: 768,
        temperature: 0,
        system: GAP_CLASSIFICATION_SYSTEM,
        jsonSchema: gapVerdictJsonSchema,
        toolName: GAP_VERDICT_TOOL_NAME,
        toolDescription: GAP_VERDICT_TOOL_DESCRIPTION,
      },
    );
    const parsed = validateStructured(gapVerdictResultSchema, completion.structured);

    // Faithfulness guards: no evidence ⇒ MISSING; citations come from the
    // retrieved passage the model pointed at (never an invented clause/page).
    const status: GapStatus = passages.length === 0 ? 'MISSING' : parsed.status;
    let procedureCitation: Citation | null = null;
    let evidenceQuote = '';
    if (status !== 'MISSING') {
      const idx = parsed.procedureEvidenceIndex;
      const passage = idx >= 1 && idx <= passages.length ? passages[idx - 1] : undefined;
      if (passage) {
        procedureCitation = { clauseRef: passage.clauseRef, page: passage.page };
        evidenceQuote = parsed.evidenceQuote;
      }
    }

    return {
      requirement,
      status,
      severity: parsed.severity,
      standardCitation: { clauseRef: requirement.clauseRef, page: requirement.page },
      procedureCitation,
      evidenceQuote,
      rationale: parsed.rationale,
      recommendedAction: parsed.recommendedAction,
    };
  }

  private async extractFromSection(
    standardTitle: string,
    sectionText: string,
  ): Promise<Array<Omit<Requirement, 'id'>>> {
    const completion = await this.llm.complete(
      [{ role: 'user', content: buildExtractionUserMessage(standardTitle, sectionText) }],
      {
        model: REASONING,
        maxTokens: 1500,
        temperature: 0,
        system: REQUIREMENT_EXTRACTION_SYSTEM,
        jsonSchema: requirementsJsonSchema,
        toolName: REQUIREMENTS_TOOL_NAME,
        toolDescription: REQUIREMENTS_TOOL_DESCRIPTION,
      },
    );
    return validateStructured(requirementsResultSchema, completion.structured).requirements;
  }

  /** Step 2 — embed the requirement and retrieve top-k PROCEDURE chunks. */
  private async retrieveProcedure(
    requirement: Requirement,
    procedureDocId: string,
  ): Promise<ProcedurePassage[]> {
    const [queryEmbedding] = await this.embeddings.embed([requirement.text]);
    if (!queryEmbedding) return [];
    const results = await this.vectorStore.search(queryEmbedding, this.topK, {
      docId: procedureDocId,
      docType: 'procedure',
    });
    return results.map((r) => ({
      clauseRef: r.chunk.metadata.clauseRef,
      page: r.chunk.metadata.page,
      text: r.chunk.text,
      ...(r.chunk.metadata.subDocId ? { subDocId: r.chunk.metadata.subDocId } : {}),
    }));
  }
}

/** Step 4 — roll verdicts up into a GapReport. Exported for direct testing. */
export function aggregateReport(
  standardDocId: string,
  procedureDocId: string,
  verdicts: GapVerdict[],
): GapReport {
  const counts: Record<GapStatus, number> = { FULL: 0, PARTIAL: 0, MISSING: 0 };
  for (const v of verdicts) counts[v.status] += 1;
  const total = verdicts.length;
  const coverageScore = total === 0 ? 0 : Math.round((counts.FULL / total) * 100);
  return { standardDocId, procedureDocId, coverageScore, counts, matrix: verdicts };
}

/** Group chunks into per-section batches under a character budget. */
function groupSections(chunks: Chunk[], maxChars: number): string[] {
  // Group consecutive chunks sharing a top-level section.
  const groups: Chunk[][] = [];
  for (const c of chunks) {
    const key = c.metadata.sectionPath[0] ?? c.metadata.clauseRef;
    const last = groups[groups.length - 1];
    const lastKey = last ? (last[0]!.metadata.sectionPath[0] ?? last[0]!.metadata.clauseRef) : null;
    if (last && lastKey === key) last.push(c);
    else groups.push([c]);
  }
  // Split any group exceeding the budget, then render with citation anchors.
  const batches: Chunk[][] = [];
  for (const group of groups) {
    let current: Chunk[] = [];
    let length = 0;
    for (const c of group) {
      if (current.length > 0 && length + c.text.length > maxChars) {
        batches.push(current);
        current = [];
        length = 0;
      }
      current.push(c);
      length += c.text.length;
    }
    if (current.length > 0) batches.push(current);
  }
  return batches.map(renderChunks);
}

function renderChunks(chunks: Chunk[]): string {
  return chunks
    .map((c) => {
      const anchor = c.metadata.clauseRef
        ? `[§${c.metadata.clauseRef} p.${c.metadata.page}]`
        : `[p.${c.metadata.page}]`;
      return `${anchor} ${c.text}`;
    })
    .join('\n\n');
}

function combinedHash(standardHash: string, procedureHash: string): string {
  return createHash('sha256').update(`${standardHash}:${procedureHash}`).digest('hex');
}

/** Run `fn` over items with at most `limit` in flight; results keep input order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}
