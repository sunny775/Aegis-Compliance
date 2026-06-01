import { readFile } from 'fs/promises';
import path from 'path';
import type { Providers } from './composition';
import type { DocType } from './domain/types';

/**
 * Seed the corpus on boot (ARCHITECTURE.md §2): ingest all six supplied PDFs,
 * then PRE-RUN the showcase gap report (ACME Tyre Procedure ↔ Recognised
 * Standard 13) so the app opens populated with an impressive result.
 *
 * Stable ids let the pre-run reference 'rs13' and 'acme-tyre' deterministically.
 */

interface SeedDoc {
  id: string;
  file: string;
  title: string;
  docType: DocType;
}

const SHOWCASE = { standardId: 'rs13', procedureId: 'acme-tyre' };

const CORPUS: SeedDoc[] = [
  {
    id: 'acme-tyre',
    file: 'ACME Mine Tyre, Wheel And Rim Management Procedure.pdf',
    title: 'ACME Mine Tyre, Wheel and Rim Management Procedure',
    docType: 'procedure',
  },
  {
    id: 'rs13',
    file: 'recognised-standard-13 (tyre_wheel_rim).pdf',
    title: 'Recognised Standard 13 — Tyre, Wheel and Rim Management',
    docType: 'standard',
  },
  /* {
    id: 'acme-mine',
    file: 'ACME-Mine.pdf',
    title: 'ACME Mine — SHMS Document Set',
    docType: 'procedure',
  },
  {
    id: 'rs03',
    file: 'recognised-standard-03.pdf',
    title: 'Recognised Standard 03 — Explosion-protected diesel engines',
    docType: 'standard',
  },
  {
    id: 'rs08',
    file: 'recognised-standard-08.pdf',
    title: 'Recognised Standard 08 — Conduct of mine emergency exercises',
    docType: 'standard',
  },
  {
    id: 'rs17',
    file: 'recognised-standard-17.pdf',
    title: 'Recognised Standard 17 — Hazardous chemicals',
    docType: 'standard',
  }, */
];

export interface SeedResult {
  documents: number;
  gapReport: boolean;
}

/** Directory holding the source PDFs (repo-root/docs by default). */
export function resolveDocsDir(): string {
  return process.env.DOCS_DIR ?? path.resolve(__dirname, '../../../docs');
}

export async function seedCorpus(providers: Providers): Promise<SeedResult> {
  // Idempotent: if already seeded (e.g. a hot reload), don't re-ingest.
  const existing = await providers.repository.list();
  if (existing.length >= CORPUS.length) {
    return { documents: existing.length, gapReport: true };
  }

  const docsDir = resolveDocsDir();
  let documents = 0;
  for (const doc of CORPUS) {
    const file = await readFile(path.join(docsDir, doc.file));
    await providers.ingestion.ingest({
      id: doc.id,
      title: doc.title,
      docType: doc.docType,
      file,
    });
    documents += 1;
  }

  // Pre-run the matched-pair showcase (cached thereafter). Can be disabled with
  // SEED_PRERUN_GAP=false for fast boots that don't re-bill the model.
  let gapReport = false;
  if (process.env.SEED_PRERUN_GAP !== 'false') {
    try {
      await providers.gaps.analyze(SHOWCASE.standardId, SHOWCASE.procedureId);
      gapReport = true;
    } catch (err) {
      console.error('Gap pre-run failed (continuing):', err instanceof Error ? err.message : err);
    }
  }

  return { documents, gapReport };
}
