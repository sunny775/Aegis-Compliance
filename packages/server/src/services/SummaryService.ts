import type { Chunk, KeyPoint } from '../domain/types';
import type { LLMProvider } from '../providers/LLMProvider';
import type { DocumentRepository } from '../repositories/DocumentRepository';
import { validateStructured } from '../providers/structuredOutput';
import { NotFoundError } from '../http/errors';
import {
  SUMMARY_SYSTEM,
  SECTION_SUMMARY_SYSTEM,
  SYNTHESIS_SYSTEM,
  KEY_POINTS_SYSTEM,
  keyPointsJsonSchema,
  keyPointsResultSchema,
  KEY_POINTS_TOOL_NAME,
  KEY_POINTS_TOOL_DESCRIPTION,
} from '../prompts/summaryPrompts';

/**
 * SummaryService (ARCHITECTURE.md §4.2) — plain-English summaries and structured
 * key points, both on the cheap tier (§8.1). Long documents (e.g. RS17, 171pp)
 * are summarized map-reduce: summarize each section, then synthesize, so a single
 * request never has to hold the whole document. Results are cached on the
 * DocumentRecord, keyed by docId + contentHash (§8.6) — a second call for the
 * same content never re-invokes the model.
 */

export interface SummaryServiceOptions {
  /** Below this many characters, summarize in a single pass; above it, map-reduce. */
  singlePassLimit?: number;
  /** Target characters per map-step batch. */
  mapBatchChars?: number;
  /** Cap on total key points for a long (multi-batch) document. */
  maxKeyPoints?: number;
}

export interface SummaryServiceDeps {
  llm: LLMProvider;
  repository: DocumentRepository;
  options?: SummaryServiceOptions;
}

export class SummaryService {
  private readonly llm: LLMProvider;
  private readonly repository: DocumentRepository;
  private readonly singlePassLimit: number;
  private readonly mapBatchChars: number;
  private readonly maxKeyPoints: number;

  constructor(deps: SummaryServiceDeps) {
    this.llm = deps.llm;
    this.repository = deps.repository;
    this.singlePassLimit = deps.options?.singlePassLimit ?? 12_000;
    this.mapBatchChars = deps.options?.mapBatchChars ?? 8_000;
    this.maxKeyPoints = deps.options?.maxKeyPoints ?? 25;
  }

  /** Plain-English summary (tier cheap, temperature ~0.3), cached per §8.6. */
  async summarize(docId: string): Promise<string> {
    const record = await this.repository.getById(docId);
    if (!record) throw new NotFoundError(`Document not found: ${docId}`);
    if (record.summary !== undefined) return record.summary; // cache hit — no model call

    const chunks = await this.repository.getChunks(docId);
    const summary = chunks.length === 0 ? '' : await this.buildSummary(chunks, record.title);

    record.summary = summary;
    await this.repository.save(record);
    return summary;
  }

  /** Structured key points (tier cheap, temperature ~0.1), cached per §8.6. */
  async extractKeyPoints(docId: string): Promise<KeyPoint[]> {
    const record = await this.repository.getById(docId);
    if (!record) throw new NotFoundError(`Document not found: ${docId}`);
    if (record.keyPoints !== undefined) return record.keyPoints; // cache hit — no model call

    const chunks = await this.repository.getChunks(docId);
    const keyPoints = chunks.length === 0 ? [] : await this.buildKeyPoints(chunks, record.title);

    record.keyPoints = keyPoints;
    await this.repository.save(record);
    return keyPoints;
  }

  private async buildSummary(chunks: Chunk[], title: string): Promise<string> {
    if (totalChars(chunks) <= this.singlePassLimit) {
      return this.summarizeText(SUMMARY_SYSTEM, renderChunks(chunks), title);
    }
    // Map: summarize each section batch. Reduce: synthesize the partials.
    const batches = batchByChars(chunks, this.mapBatchChars);
    const partials: string[] = [];
    for (const batch of batches) {
      partials.push(await this.summarizeText(SECTION_SUMMARY_SYSTEM, renderChunks(batch), title));
    }
    const combined = partials.map((p, i) => `Section ${i + 1}: ${p}`).join('\n\n');
    return this.summarizeText(SYNTHESIS_SYSTEM, combined, title);
  }

  private async summarizeText(system: string, content: string, title: string): Promise<string> {
    const completion = await this.llm.complete(
      [{ role: 'user', content: `Document title: ${title}\n\n${content}` }],
      { model: 'cheap', maxTokens: 800, temperature: 0.3, system },
    );
    return (completion.text ?? '').trim();
  }

  private async buildKeyPoints(chunks: Chunk[], title: string): Promise<KeyPoint[]> {
    if (totalChars(chunks) <= this.singlePassLimit) {
      return this.extractFrom(renderChunks(chunks), title);
    }
    const batches = batchByChars(chunks, this.mapBatchChars);
    const all: KeyPoint[] = [];
    for (const batch of batches) {
      all.push(...(await this.extractFrom(renderChunks(batch), title)));
    }
    return all.slice(0, this.maxKeyPoints);
  }

  private async extractFrom(content: string, title: string): Promise<KeyPoint[]> {
    const completion = await this.llm.complete(
      [{ role: 'user', content: `Document title: ${title}\n\n${content}` }],
      {
        model: 'cheap',
        maxTokens: 1024,
        temperature: 0.1,
        system: KEY_POINTS_SYSTEM,
        jsonSchema: keyPointsJsonSchema,
        toolName: KEY_POINTS_TOOL_NAME,
        toolDescription: KEY_POINTS_TOOL_DESCRIPTION,
      },
    );
    return validateStructured(keyPointsResultSchema, completion.structured).keyPoints;
  }
}

function totalChars(chunks: Chunk[]): number {
  return chunks.reduce((n, c) => n + c.text.length, 0);
}

/** Group consecutive chunks into batches under the character budget. */
function batchByChars(chunks: Chunk[], maxChars: number): Chunk[][] {
  const batches: Chunk[][] = [];
  let current: Chunk[] = [];
  let length = 0;
  for (const chunk of chunks) {
    if (current.length > 0 && length + chunk.text.length > maxChars) {
      batches.push(current);
      current = [];
      length = 0;
    }
    current.push(chunk);
    length += chunk.text.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** Render chunks with citation anchors so the model can ground clauseRef/page. */
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
