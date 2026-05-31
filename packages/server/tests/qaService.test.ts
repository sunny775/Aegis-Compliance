import { describe, it, expect } from 'vitest';
import { QAService } from '../src/services/QAService';
import type { Chunk } from '../src/domain/types';
import type { VectorSearchResult } from '../src/providers/VectorStore';

function chunk(id: string, clauseRef: string, page: number, text: string): Chunk {
  return {
    id,
    text,
    metadata: {
      docId: 'doc-1',
      docType: 'procedure',
      sectionPath: [clauseRef],
      clauseRef,
      headingTrail: 'H',
      page,
      charRange: [0, text.length],
    },
  };
}

interface Captured {
  embedInputs: string[][];
  searchArgs: Array<{ k: number; filter: unknown }>;
  completeMessages: any[];
  completeOptions: any[];
}

function buildService(searchResults: VectorSearchResult[]) {
  const captured: Captured = { embedInputs: [], searchArgs: [], completeMessages: [], completeOptions: [] };

  const embeddings = {
    embed: async (texts: string[]) => {
      captured.embedInputs.push(texts);
      return [[0.1, 0.2, 0.3]];
    },
  };
  const vectorStore = {
    add: async () => {},
    search: async (_q: number[], k: number, filter: unknown) => {
      captured.searchArgs.push({ k, filter });
      return searchResults;
    },
  };
  const llm = {
    complete: async (messages: any[], options: any) => {
      captured.completeMessages.push(messages);
      captured.completeOptions.push(options);
      return {
        text: 'Operators must wear PPE near tyre inflation (§8.5, p.3).',
        structured: null,
        usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
        stopReason: 'end_turn',
      };
    },
    stream: async function* (messages: any[], options: any) {
      captured.completeMessages.push(messages);
      captured.completeOptions.push(options);
      yield 'Wear ';
      yield 'PPE (§8.5, p.3).';
    },
  };
  const repository = {
    getById: async (id: string) => (id === 'doc-1' ? { id, title: 'ACME Tyre Procedure' } : undefined),
    save: async () => {},
    list: async () => [],
    saveChunks: async () => {},
    getChunks: async () => [],
    saveGapReport: async () => {},
    getGapReport: async () => undefined,
  };

  const service = new QAService({
    llm: llm as any,
    embeddings: embeddings as any,
    vectorStore: vectorStore as any,
    repository: repository as any,
    options: { topK: 4 },
  });
  return { service, captured };
}

const RESULTS: VectorSearchResult[] = [
  { chunk: chunk('c1', '8.5', 3, 'Inflate in an approved inflation cage or behind a blast wall.'), score: 0.91 },
  { chunk: chunk('c2', '10', 4, 'Establish an exclusion zone and use physical barricades.'), score: 0.74 },
];

describe('QAService.ask (grounded RAG)', () => {
  it('embeds the question and retrieves scoped to the docId', async () => {
    const { service, captured } = buildService(RESULTS);
    await service.ask('doc-1', 'What PPE is required for tyre inflation?');

    expect(captured.embedInputs).toEqual([['What PPE is required for tyre inflation?']]);
    expect(captured.searchArgs[0]!.k).toBe(4);
    expect(captured.searchArgs[0]!.filter).toEqual({ docId: 'doc-1' });
  });

  it('passes the retrieved context into the grounded prompt', async () => {
    const { service, captured } = buildService(RESULTS);
    await service.ask('doc-1', 'What PPE is required?');

    const userContent = captured.completeMessages[0]![0]!.content as string;
    // Retrieved chunk text and citation anchors are present in the prompt.
    expect(userContent).toContain('Inflate in an approved inflation cage');
    expect(userContent).toContain('§8.5, p.3');
    expect(userContent).toContain('exclusion zone');
    expect(userContent).toContain('What PPE is required?');

    const opts = captured.completeOptions[0]!;
    expect(opts.model).toBe('cheap');
    expect(opts.temperature).toBe(0);
    expect(typeof opts.system).toBe('string'); // grounding instruction present
    expect(opts.system).toMatch(/only/i);
  });

  it('returns the answer plus citable sources', async () => {
    const { service } = buildService(RESULTS);
    const result = await service.ask('doc-1', 'What PPE is required?');

    expect(result.answer).toContain('§8.5, p.3');
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0]).toMatchObject({ chunkId: 'c1', clauseRef: '8.5', page: 3, score: 0.91 });
    expect(result.sources[0]!.excerpt).toContain('Inflate');
  });

  it('declines (no model call) when retrieval returns nothing', async () => {
    const { service, captured } = buildService([]);
    const result = await service.ask('doc-1', 'Unrelated question?');

    expect(result.answer).toMatch(/does not contain information/i);
    expect(result.sources).toEqual([]);
    expect(captured.completeMessages).toHaveLength(0); // model never invoked
  });

  it('throws NotFound for an unknown document', async () => {
    const { service } = buildService(RESULTS);
    await expect(service.ask('missing', 'q')).rejects.toThrow(/not found/i);
  });
});

describe('QAService.askStream', () => {
  it('returns sources up front and streams the answer tokens', async () => {
    const { service, captured } = buildService(RESULTS);
    const { sources, stream } = await service.askStream('doc-1', 'What PPE is required?');

    expect(sources).toHaveLength(2);
    expect(sources[0]!.clauseRef).toBe('8.5');

    let answer = '';
    for await (const delta of stream) answer += delta;
    expect(answer).toBe('Wear PPE (§8.5, p.3).');

    // The grounded context still reached the streaming prompt.
    const userContent = captured.completeMessages[0]![0]!.content as string;
    expect(userContent).toContain('Inflate in an approved inflation cage');
  });
});
