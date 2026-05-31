import { describe, it, expect } from 'vitest';
import { GapAnalysisService, aggregateReport } from '../src/services/GapAnalysisService';
import { InMemoryDocumentRepository } from '../src/repositories/InMemoryDocumentRepository';
import type { Chunk, DocumentRecord, GapStatus, GapVerdict, Requirement } from '../src/domain/types';

const REQ: Requirement = {
  id: 'req-1',
  text: 'Establish an exclusion zone during tyre inflation.',
  clauseRef: '4.5',
  page: 23,
  category: 'Inflation safety',
};

const usage = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };

function verdict(status: GapStatus): GapVerdict {
  return {
    requirement: REQ,
    status,
    severity: 'High',
    standardCitation: { clauseRef: '4.5', page: 23 },
    procedureCitation: status === 'MISSING' ? null : { clauseRef: '8.5', page: 3 },
    evidenceQuote: '',
    rationale: '',
    recommendedAction: '',
  };
}

describe('aggregateReport', () => {
  it('computes counts and coverage score over a fixture set', () => {
    const report = aggregateReport('rs13', 'acme', [
      verdict('FULL'),
      verdict('FULL'),
      verdict('PARTIAL'),
      verdict('MISSING'),
    ]);

    expect(report.counts).toEqual({ FULL: 2, PARTIAL: 1, MISSING: 1 });
    expect(report.coverageScore).toBe(50); // 2 of 4 FULL
    expect(report.matrix).toHaveLength(4);
    expect(report.standardDocId).toBe('rs13');
    expect(report.procedureDocId).toBe('acme');
  });

  it('is 100 when everything is FULL and 0 when empty', () => {
    expect(aggregateReport('s', 'p', [verdict('FULL'), verdict('FULL')]).coverageScore).toBe(100);
    expect(aggregateReport('s', 'p', []).coverageScore).toBe(0);
  });
});

describe('GapAnalysisService.classifyCoverage', () => {
  it('returns MISSING when no procedure evidence was retrieved (even if the model says otherwise)', async () => {
    // The model is mocked to claim FULL — the empty-evidence guard must override it.
    const llm = {
      complete: async () => ({
        text: null,
        structured: {
          status: 'FULL',
          severity: 'Critical',
          procedureEvidenceIndex: 1,
          evidenceQuote: 'hallucinated',
          rationale: 'r',
          recommendedAction: 'a',
        },
        usage,
        stopReason: 'tool_use',
      }),
      stream: async function* () {},
    };
    const service = new GapAnalysisService({
      llm: llm as any,
      embeddings: {} as any,
      vectorStore: {} as any,
      repository: {} as any,
    });

    const v = await service.classifyCoverage(REQ, []);
    expect(v.status).toBe('MISSING');
    expect(v.procedureCitation).toBeNull();
    expect(v.evidenceQuote).toBe('');
    // Standard citation is taken from the requirement (never model-invented).
    expect(v.standardCitation).toEqual({ clauseRef: '4.5', page: 23 });
    // Risk-weighted severity still comes from the model.
    expect(v.severity).toBe('Critical');
  });

  it('derives the procedure citation from the passage the model points at', async () => {
    const llm = {
      complete: async () => ({
        text: null,
        structured: {
          status: 'FULL',
          severity: 'High',
          procedureEvidenceIndex: 2,
          evidenceQuote: 'Establish an exclusion zone equal to 1.5 × tyre diameter.',
          rationale: 'covered',
          recommendedAction: 'none',
        },
        usage,
        stopReason: 'tool_use',
      }),
      stream: async function* () {},
    };
    const service = new GapAnalysisService({
      llm: llm as any,
      embeddings: {} as any,
      vectorStore: {} as any,
      repository: {} as any,
    });

    const v = await service.classifyCoverage(REQ, [
      { clauseRef: '8.4', page: 3, text: 'Fitment and removal …' },
      { clauseRef: '8.5', page: 3, text: 'Establish an exclusion zone …' },
    ]);
    expect(v.status).toBe('FULL');
    expect(v.procedureCitation).toEqual({ clauseRef: '8.5', page: 3 }); // passage #2
    expect(v.evidenceQuote).toContain('exclusion zone');
  });
});

describe('GapAnalysisService.analyze (pipeline + caching)', () => {
  function makeChunk(docId: string, docType: 'standard' | 'procedure', clauseRef: string, page: number): Chunk {
    return {
      id: `${docId}:${clauseRef}`,
      text: `Text for ${clauseRef}`,
      metadata: {
        docId,
        docType,
        sectionPath: [clauseRef.split('.')[0]!],
        clauseRef,
        headingTrail: 'H',
        page,
        charRange: [0, 10],
      },
    };
  }

  async function seed(repo: InMemoryDocumentRepository) {
    const standard: DocumentRecord = {
      id: 'rs13',
      title: 'Recognised Standard 13',
      docType: 'standard',
      pageCount: 48,
      sizeBytes: 1,
      contentHash: 'h-std',
    };
    const procedure: DocumentRecord = {
      id: 'acme',
      title: 'ACME Tyre Procedure',
      docType: 'procedure',
      pageCount: 6,
      sizeBytes: 1,
      contentHash: 'h-proc',
    };
    await repo.save(standard);
    await repo.save(procedure);
    await repo.saveChunks('rs13', [makeChunk('rs13', 'standard', '4', 23)]);
    await repo.saveChunks('acme', [makeChunk('acme', 'procedure', '8.5', 3)]);
  }

  function fakeLLM() {
    let calls = 0;
    const llm = {
      complete: async (_messages: any, options: any) => {
        calls += 1;
        if (options.jsonSchema?.properties?.requirements) {
          return {
            text: null,
            structured: {
              requirements: [
                { text: 'Requirement A', clauseRef: '4.5', page: 23, category: 'Inflation' },
                { text: 'Requirement B', clauseRef: '4.6', page: 26, category: 'Operation' },
              ],
            },
            usage,
            stopReason: 'tool_use',
          };
        }
        return {
          text: null,
          structured: {
            status: 'FULL',
            severity: 'Medium',
            procedureEvidenceIndex: 1,
            evidenceQuote: 'q',
            rationale: 'r',
            recommendedAction: 'a',
          },
          usage,
          stopReason: 'tool_use',
        };
      },
      stream: async function* () {},
    };
    return { llm, calls: () => calls };
  }

  it('extracts, classifies per requirement, aggregates, and caches the report', async () => {
    const repo = new InMemoryDocumentRepository();
    await seed(repo);

    let searchFilter: unknown;
    const embeddings = { embed: async (t: string[]) => t.map(() => [0.1, 0.2]) };
    const vectorStore = {
      add: async () => {},
      search: async (_q: number[], _k: number, filter: unknown) => {
        searchFilter = filter;
        return [{ chunk: makeChunk('acme', 'procedure', '8.5', 3), score: 0.9 }];
      },
    };
    const { llm, calls } = fakeLLM();

    const service = new GapAnalysisService({
      llm: llm as any,
      embeddings: embeddings as any,
      vectorStore: vectorStore as any,
      repository: repo,
    });

    const report = await service.analyze('rs13', 'acme');

    expect(report.matrix).toHaveLength(2); // 2 requirements extracted
    expect(report.counts.FULL).toBe(2);
    expect(report.coverageScore).toBe(100);
    expect(report.matrix[0]!.requirement.id).toBe('req-1');
    // Retrieval was scoped to the procedure index.
    expect(searchFilter).toEqual({ docId: 'acme', docType: 'procedure' });
    // 1 extraction call + 2 classification calls.
    expect(calls()).toBe(3);

    // Second analyze for the same content is served from cache — no new calls.
    const again = await service.analyze('rs13', 'acme');
    expect(again.coverageScore).toBe(100);
    expect(calls()).toBe(3);
  });
});
