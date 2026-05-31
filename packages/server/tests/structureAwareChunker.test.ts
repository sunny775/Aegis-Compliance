import { describe, it, expect } from 'vitest';
import { StructureAwareChunker } from '../src/chunking/StructureAwareChunker';
import { RecursiveChunker } from '../src/chunking/RecursiveChunker';
import type { ParsedDocument } from '../src/providers/DocumentParser';

function doc(pages: Array<{ page: number; text: string }>, extra: Partial<ParsedDocument> = {}) {
  return { pages, ...extra } as ParsedDocument;
}

describe('StructureAwareChunker', () => {
  it('keeps a numbered clause intact in one chunk with correct provenance', () => {
    const text = [
      '8 Tyre, Wheel and Rim Lifecycle Management',
      '8.5 Inflation and Pressure Control',
      'Inflate in an approved inflation cage or behind a blast wall.',
      'Establish an exclusion zone equal to 1.5 times tyre diameter.',
      '8.6 Operation and Monitoring',
      'Telematics alert for low or high pressure.',
    ].join('\n');

    const chunker = new StructureAwareChunker();
    const chunks = chunker.chunk(doc([{ page: 3, text }]), {
      docId: 'acme',
      docType: 'procedure',
    });

    const clause85 = chunks.filter((c) => c.metadata.clauseRef === '8.5');
    expect(clause85).toHaveLength(1);

    const chunk = clause85[0]!;
    expect(chunk.metadata.sectionPath).toEqual(['8', '8.5']);
    expect(chunk.metadata.page).toBe(3);
    expect(chunk.metadata.docId).toBe('acme');
    expect(chunk.metadata.docType).toBe('procedure');
    expect(chunk.text).toContain('Inflation and Pressure Control');
    expect(chunk.text).toContain('exclusion zone');
    // The clause boundary holds: the next clause's body is NOT in this chunk.
    expect(chunk.text).not.toContain('Operation and Monitoring');
    expect(chunk.metadata.headingTrail).toBe(
      'Tyre, Wheel and Rim Lifecycle Management > Inflation and Pressure Control',
    );
  });

  it('prefers the ToC page map over page tracking for the clause page', () => {
    const chunker = new StructureAwareChunker();
    const chunks = chunker.chunk(
      doc([{ page: 1, text: '4.5 Maintenance and Upkeep\nInspect rims for cracks.' }], {
        tocPageMap: new Map([['4.5', 23]]),
      }),
      { docId: 'rs13', docType: 'standard' },
    );
    expect(chunks[0]!.metadata.page).toBe(23);
  });

  it('sub-splits an over-long clause into windows that inherit its metadata', () => {
    const body = 'Inflate safely and record the cold pressure in the register. '.repeat(8);
    const text = `8.5 Inflation and Pressure Control\n${body}`;

    const chunker = new StructureAwareChunker({ maxChars: 80, overlap: 15 });
    const chunks = chunker.chunk(doc([{ page: 4, text }]), {
      docId: 'acme',
      docType: 'procedure',
    });

    const windows = chunks.filter((c) => c.metadata.clauseRef === '8.5');
    expect(windows.length).toBeGreaterThan(1);
    // Every window inherits the parent clause's provenance.
    for (const w of windows) {
      expect(w.metadata.clauseRef).toBe('8.5');
      expect(w.metadata.sectionPath).toEqual(['8', '8.5']);
      expect(w.metadata.page).toBe(4);
    }
    // Ids are unique.
    expect(new Set(windows.map((w) => w.id)).size).toBe(windows.length);
  });

  it('degrades to the recursive fallback when no hierarchy is detected', () => {
    const text = 'This is plain prose with no numbered headings.\n\nAnother paragraph here.';
    const chunker = new StructureAwareChunker({ fallback: new RecursiveChunker({ maxChars: 40 }) });
    const chunks = chunker.chunk(doc([{ page: 1, text }]), { docId: 'plain', docType: 'standard' });

    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.metadata.clauseRef).toBe('');
      expect(c.metadata.sectionPath).toEqual([]);
    }
  });
});
