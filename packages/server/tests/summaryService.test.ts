import { describe, it, expect, beforeEach } from 'vitest';
import { SummaryService } from '../src/services/SummaryService';
import { InMemoryDocumentRepository } from '../src/repositories/InMemoryDocumentRepository';
import type { Chunk, DocumentRecord } from '../src/domain/types';

function makeChunk(id: string, clauseRef: string, page: number, text: string): Chunk {
  return {
    id,
    text,
    metadata: {
      docId: 'doc-1',
      docType: 'standard',
      sectionPath: clauseRef ? [clauseRef] : [],
      clauseRef,
      headingTrail: 'H',
      page,
      charRange: [0, text.length],
    },
  };
}

/** Mock LLM that counts calls and answers summary vs. key-point requests. */
function fakeLLM() {
  let calls = 0;
  const llm = {
    complete: async (_messages: any, options: any) => {
      calls += 1;
      const usage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      };
      if (options.jsonSchema) {
        return {
          text: null,
          structured: { keyPoints: [{ text: 'Wear PPE near tyre inflation', clauseRef: '8.5', page: 3 }] },
          usage,
          stopReason: 'tool_use',
        };
      }
      return { text: 'A plain-English summary.', structured: null, usage, stopReason: 'end_turn' };
    },
    stream: async function* () {
      yield '';
    },
  };
  return { llm, calls: () => calls };
}

async function seed(repo: InMemoryDocumentRepository, chunks: Chunk[]): Promise<DocumentRecord> {
  const record: DocumentRecord = {
    id: 'doc-1',
    title: 'Recognised Standard 13',
    docType: 'standard',
    pageCount: 1,
    sizeBytes: 100,
    contentHash: 'hash-abc',
  };
  await repo.save(record);
  await repo.saveChunks('doc-1', chunks);
  return record;
}

describe('SummaryService caching', () => {
  let repo: InMemoryDocumentRepository;

  beforeEach(async () => {
    repo = new InMemoryDocumentRepository();
    await seed(repo, [makeChunk('c1', '8.5', 3, 'Inflate tyres safely behind a blast wall.')]);
  });

  it('summarize: second call for the same docId+hash is served from cache', async () => {
    const { llm, calls } = fakeLLM();
    const service = new SummaryService({ llm: llm as any, repository: repo });

    const first = await service.summarize('doc-1');
    expect(first).toBe('A plain-English summary.');
    expect(calls()).toBe(1);

    const second = await service.summarize('doc-1');
    expect(second).toBe(first);
    expect(calls()).toBe(1); // no further model call

    // Cached on the persisted record.
    expect((await repo.getById('doc-1'))!.summary).toBe('A plain-English summary.');
  });

  it('extractKeyPoints: second call is served from cache and Zod-validated', async () => {
    const { llm, calls } = fakeLLM();
    const service = new SummaryService({ llm: llm as any, repository: repo });

    const first = await service.extractKeyPoints('doc-1');
    expect(first).toEqual([{ text: 'Wear PPE near tyre inflation', clauseRef: '8.5', page: 3 }]);
    expect(calls()).toBe(1);

    const second = await service.extractKeyPoints('doc-1');
    expect(second).toEqual(first);
    expect(calls()).toBe(1); // no further model call

    expect((await repo.getById('doc-1'))!.keyPoints).toEqual(first);
  });

  it('throws NotFound for an unknown document', async () => {
    const { llm } = fakeLLM();
    const service = new SummaryService({ llm: llm as any, repository: repo });
    await expect(service.summarize('missing')).rejects.toThrow(/not found/i);
  });
});

describe('SummaryService map-reduce for long documents', () => {
  it('summarizes per-section then synthesizes (N map calls + 1 reduce)', async () => {
    const repo = new InMemoryDocumentRepository();
    // Three chunks of ~8 chars each, with tiny thresholds → two map batches.
    await seed(repo, [
      makeChunk('c1', '1', 1, 'aaaaaaaa'),
      makeChunk('c2', '2', 2, 'bbbbbbbb'),
      makeChunk('c3', '3', 3, 'cccccccc'),
    ]);

    const { llm, calls } = fakeLLM();
    const service = new SummaryService({
      llm: llm as any,
      repository: repo,
      options: { singlePassLimit: 10, mapBatchChars: 10 },
    });

    await service.summarize('doc-1');
    // batches: [c1] (8), [c2] (8), [c3] (8) → 3 map calls + 1 synthesis = 4
    expect(calls()).toBe(4);
  });
});
