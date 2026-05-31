import { describe, it, expect } from 'vitest';
import { InMemoryVectorStore, cosineSimilarity } from '../src/providers/InMemoryVectorStore';
import type { Chunk, ChunkMetadata } from '../src/domain/types';

function makeChunk(id: string, meta: Partial<ChunkMetadata> = {}): Chunk {
  return {
    id,
    text: `chunk ${id}`,
    metadata: {
      docId: 'doc-1',
      docType: 'procedure',
      sectionPath: ['1'],
      clauseRef: '1',
      headingTrail: 'Heading',
      page: 1,
      charRange: [0, 10],
      ...meta,
    },
  };
}

describe('InMemoryVectorStore', () => {
  it('ranks results by cosine similarity, nearest first', async () => {
    const store = new InMemoryVectorStore();
    await store.add(
      [makeChunk('a'), makeChunk('b'), makeChunk('c')],
      [
        [1, 0, 0], // identical direction → score 1
        [0.8, 0.2, 0], // close
        [0, 1, 0], // orthogonal → score 0
      ],
    );

    const results = await store.search([1, 0, 0], 3);

    expect(results.map((r) => r.chunk.id)).toEqual(['a', 'b', 'c']);
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
    expect(results[1]!.score).toBeGreaterThan(results[2]!.score);
  });

  it('respects k by returning at most k results', async () => {
    const store = new InMemoryVectorStore();
    await store.add([makeChunk('a'), makeChunk('b'), makeChunk('c')], [
      [1, 0, 0],
      [1, 0, 0],
      [1, 0, 0],
    ]);
    const results = await store.search([1, 0, 0], 2);
    expect(results).toHaveLength(2);
  });

  it('excludes chunks that do not match the docType filter', async () => {
    const store = new InMemoryVectorStore();
    await store.add(
      [
        makeChunk('proc', { docId: 'P', docType: 'procedure' }),
        makeChunk('std', { docId: 'S', docType: 'standard' }),
      ],
      [
        [1, 0, 0],
        [1, 0, 0], // same vector — only the filter distinguishes them
      ],
    );

    const results = await store.search([1, 0, 0], 10, { docType: 'procedure' });

    expect(results).toHaveLength(1);
    expect(results[0]!.chunk.id).toBe('proc');
  });

  it('scopes by docId and subDocId (bundle scoping)', async () => {
    const store = new InMemoryVectorStore();
    await store.add(
      [
        makeChunk('s1', { docId: 'bundle', subDocId: 'sub-1' }),
        makeChunk('s2', { docId: 'bundle', subDocId: 'sub-2' }),
        makeChunk('other', { docId: 'other-doc', subDocId: 'sub-1' }),
      ],
      [
        [1, 0, 0],
        [1, 0, 0],
        [1, 0, 0],
      ],
    );

    const results = await store.search([1, 0, 0], 10, { docId: 'bundle', subDocId: 'sub-1' });

    expect(results.map((r) => r.chunk.id)).toEqual(['s1']);
  });

  it('rejects a length mismatch between chunks and embeddings', async () => {
    const store = new InMemoryVectorStore();
    await expect(store.add([makeChunk('a')], [])).rejects.toThrow(/length mismatch/);
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for vectors pointing the same direction', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('is 0 when either vector is all zeros', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});
