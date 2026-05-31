import { describe, it, expect } from 'vitest';
import { detectSubDocuments } from '../src/ingestion/subDocuments';
import { StructureAwareChunker } from '../src/chunking/StructureAwareChunker';
import type { ParsedDocument, ParsedPage } from '../src/providers/DocumentParser';

// An ACME-Mine-style bundle: two independent sub-documents, each with a title +
// header block and its own "1. Purpose / 2. Scope" numbering.
const bundlePages: ParsedPage[] = [
  {
    page: 1,
    text: [
      '793F Dumping Operation',
      'Document Title: 793F Dumping Operation  Document Type: Safe Work Instruction',
      'Effective Date: 21/06/2025  Review Period: 3 years',
      '1. Purpose',
      'This SWI covers safe dumping at the tip head.',
      '2. Scope',
      'Applies to all 793F operators.',
    ].join('\n'),
  },
  {
    page: 2,
    text: [
      'Alcohol and Drug Testing Procedure',
      'Human Factors SHMS Group  Effective Date: 21/06/2025  Review Period: 3 years',
      '1. Purpose',
      'Establish a framework for alcohol and drug testing.',
      '2. Scope',
      'Applies to all workers and contractors.',
    ].join('\n'),
  },
];

describe('detectSubDocuments', () => {
  it('splits a bundle into the correct sub-documents with distinct ids', () => {
    const subs = detectSubDocuments(bundlePages);

    expect(subs).toHaveLength(2);
    expect(subs[0]!.title).toBe('793F Dumping Operation');
    expect(subs[1]!.title).toBe('Alcohol and Drug Testing Procedure');
    expect(subs[0]!.startPage).toBe(1);
    expect(subs[0]!.endPage).toBe(1);
    expect(subs[1]!.startPage).toBe(2);
    expect(subs[1]!.endPage).toBe(2);

    const ids = subs.map((s) => s.subDocId);
    expect(new Set(ids).size).toBe(2); // distinct
  });

  it('does not split a single document with one metadata page', () => {
    const single: ParsedPage[] = [
      {
        page: 1,
        text: 'Tyre Procedure\nEffective Date: 2025\n1. Purpose\nManage tyres.\n2. Scope\nAll site.',
      },
      { page: 2, text: '3. References\nRecognised Standard 13.' },
    ];
    expect(detectSubDocuments(single)).toEqual([]);
  });
});

describe('bundle chunking scopes clause refs to sub-documents', () => {
  it('produces clause "1" in each sub-document without collision', () => {
    const subDocuments = detectSubDocuments(bundlePages);
    const parsed = { pages: bundlePages, subDocuments } as ParsedDocument;

    const chunker = new StructureAwareChunker();
    const chunks = chunker.chunk(parsed, { docId: 'acme-mine', docType: 'procedure' });

    const clauseOne = chunks.filter((c) => c.metadata.clauseRef === '1');
    expect(clauseOne).toHaveLength(2); // one per sub-document

    const subIds = clauseOne.map((c) => c.metadata.subDocId);
    expect(subIds.every((id) => id !== undefined)).toBe(true);
    expect(new Set(subIds).size).toBe(2); // scoped, not collided

    // Both sub-documents also yield a clause "2" (Scope), each scoped.
    expect(chunks.filter((c) => c.metadata.clauseRef === '2')).toHaveLength(2);
  });
});
