import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { IngestionService } from '../src/services/IngestionService';
import type { Chunk } from '../src/domain/types';

function fakeChunk(id: string): Chunk {
  return {
    id,
    text: `text-${id}`,
    metadata: {
      docId: 'd',
      docType: 'procedure',
      sectionPath: ['1'],
      clauseRef: '1',
      headingTrail: 'H',
      page: 1,
      charRange: [0, 5],
    },
  };
}

describe('IngestionService', () => {
  it('orchestrates parse → chunk → embed (batched) → index → persist', async () => {
    const embedCalls: string[][] = [];
    let added: { chunks: Chunk[]; vectors: number[][] } | undefined;
    let savedRecord: any;
    let savedChunks: { docId: string; chunks: Chunk[] } | undefined;

    const parser = {
      parse: async () => ({
        pages: [{ page: 1, text: 'hello world' }],
        subDocuments: undefined,
      }),
    };
    const chunker = {
      chunk: () => [fakeChunk('a'), fakeChunk('b'), fakeChunk('c')],
    };
    const embeddings = {
      embed: async (texts: string[]) => {
        embedCalls.push(texts);
        return texts.map((t) => [t.length]);
      },
    };
    const vectorStore = {
      add: async (chunks: Chunk[], vectors: number[][]) => {
        added = { chunks, vectors };
      },
      search: async () => [],
    };
    const repository = {
      save: async (r: any) => {
        savedRecord = r;
      },
      saveChunks: async (docId: string, chunks: Chunk[]) => {
        savedChunks = { docId, chunks };
      },
      getById: async () => undefined,
      list: async () => [],
      getChunks: async () => [],
      saveGapReport: async () => {},
      getGapReport: async () => undefined,
    };

    const service = new IngestionService({
      parser: parser as any,
      chunker: chunker as any,
      embeddings: embeddings as any,
      vectorStore: vectorStore as any,
      repository: repository as any,
      embedBatchSize: 2,
    });

    const file = Buffer.from('the file contents');
    const record = await service.ingest({ title: 'RS13', docType: 'standard', file });

    // Embedded in batches of 2 → [2, 1].
    expect(embedCalls.map((b) => b.length)).toEqual([2, 1]);

    // All chunks + matching vectors indexed, and chunk metadata persisted.
    expect(added?.chunks).toHaveLength(3);
    expect(added?.vectors).toHaveLength(3);
    expect(savedChunks?.chunks).toHaveLength(3);
    expect(savedChunks?.docId).toBe(record.id);

    // Document record built with content hash + derived id + page count.
    const hash = createHash('sha256').update(file).digest('hex');
    expect(record.contentHash).toBe(hash);
    expect(record.id).toBe(hash.slice(0, 12));
    expect(record.pageCount).toBe(1);
    expect(record.sizeBytes).toBe(file.length);
    expect(record.title).toBe('RS13');
    expect(record.docType).toBe('standard');
    expect(savedRecord.id).toBe(record.id);
  });

  it('skips embedding/indexing when no chunks are produced', async () => {
    let addCalled = false;
    const service = new IngestionService({
      parser: { parse: async () => ({ pages: [{ page: 1, text: '' }] }) } as any,
      chunker: { chunk: () => [] } as any,
      embeddings: {
        embed: async () => {
          throw new Error('should not embed when there are no chunks');
        },
      } as any,
      vectorStore: {
        add: async () => {
          addCalled = true;
        },
        search: async () => [],
      } as any,
      repository: {
        save: async () => {},
        saveChunks: async () => {},
        getById: async () => undefined,
        list: async () => [],
        getChunks: async () => [],
        saveGapReport: async () => {},
        getGapReport: async () => undefined,
      } as any,
    });

    const record = await service.ingest({
      title: 'empty',
      docType: 'procedure',
      file: Buffer.from('x'),
    });
    expect(addCalled).toBe(false);
    expect(record.pageCount).toBe(1);
  });
});
