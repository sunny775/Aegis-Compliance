import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentService } from '../src/services/DocumentService';
import { SummaryService } from '../src/services/SummaryService';
import { InMemoryDocumentRepository } from '../src/repositories/InMemoryDocumentRepository';
import { LLMUnavailableError, NotFoundError } from '../src/http/errors';
import type { Chunk, DocumentRecord } from '../src/domain/types';

function makeChunk(text: string): Chunk {
  return {
    id: 'c1',
    text,
    metadata: {
      docId: 'doc-1',
      docType: 'standard',
      sectionPath: ['8.5'],
      clauseRef: '8.5',
      headingTrail: 'H',
      page: 3,
      charRange: [0, text.length],
    },
  };
}

async function seed(repo: InMemoryDocumentRepository): Promise<void> {
  const record: DocumentRecord = {
    id: 'doc-1',
    title: 'Recognised Standard 13',
    docType: 'standard',
    pageCount: 1,
    sizeBytes: 100,
    contentHash: 'hash-abc',
  };
  await repo.save(record);
  await repo.saveChunks('doc-1', [makeChunk('Inflate tyres safely behind a blast wall.')]);
}

/** An LLM whose calls always fail as if Claude were rate limited / usage-capped. */
function unavailableLLM() {
  return {
    complete: async () => {
      throw new LLMUnavailableError('The AI service is temporarily unavailable: usage limit reached.');
    },
    stream: async function* () {
      yield '';
    },
  };
}

describe('DocumentService.getDetail', () => {
  let repo: InMemoryDocumentRepository;

  beforeEach(async () => {
    repo = new InMemoryDocumentRepository();
    await seed(repo);
  });

  it('still returns the document when the AI is unavailable, flagging analysisError', async () => {
    const summaries = new SummaryService({ llm: unavailableLLM() as any, repository: repo });
    const service = new DocumentService(repo, summaries);

    const detail = await service.getDetail('doc-1');

    expect(detail.id).toBe('doc-1');
    expect(detail.title).toBe('Recognised Standard 13');
    expect(detail.summary).toBeUndefined();
    expect(detail.keyPoints).toEqual([]);
    expect(detail.analysisError).toMatch(/unavailable/i);
  });

  it('does not cache the degraded result — a later request retries the model', async () => {
    const service = new DocumentService(
      repo,
      new SummaryService({ llm: unavailableLLM() as any, repository: repo }),
    );
    await service.getDetail('doc-1');

    const record = await repo.getById('doc-1');
    expect(record?.summary).toBeUndefined(); // failure was never persisted
    expect(record?.keyPoints).toBeUndefined();
  });

  it('propagates a 404 for an unknown document (does not swallow it)', async () => {
    const service = new DocumentService(
      repo,
      new SummaryService({ llm: unavailableLLM() as any, repository: repo }),
    );
    await expect(service.getDetail('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});
