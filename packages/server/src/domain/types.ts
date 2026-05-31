/**
 * Core domain types. Declarations only — see ARCHITECTURE.md §5.2 (ChunkMetadata)
 * and §10 (domain model). Behaviour is added by the services that own these types.
 */

export type DocType = 'standard' | 'procedure';

/** A sub-document inside a bundle (e.g. one procedure within ACME-Mine.pdf). */
export interface SubDocument {
  subDocId: string;
  title: string;
  startPage: number;
  endPage: number;
}

export interface KeyPoint {
  text: string;
  clauseRef?: string;
  page?: number;
}

export interface DocumentRecord {
  id: string;
  title: string;
  docType: DocType;
  pageCount: number;
  sizeBytes: number;
  contentHash: string;
  subDocuments?: SubDocument[]; // populated for bundles
  summary?: string; // cached
  keyPoints?: KeyPoint[]; // cached
}

/** Provenance metadata attached to every chunk (ARCHITECTURE.md §5.2). */
export interface ChunkMetadata {
  docId: string;
  docType: DocType;
  subDocId?: string; // present for ACME-Mine.pdf sub-documents
  sectionPath: string[]; // ["4", "4.5"] — full hierarchy
  clauseRef: string; // "4.5"
  headingTrail: string; // "Technical Guidance > Maintenance and Upkeep"
  page: number; // from the ToC map / page tracking
  charRange: [number, number];
}

export interface Chunk {
  id: string;
  text: string;
  metadata: ChunkMetadata;
}

export interface Requirement {
  id: string;
  text: string;
  clauseRef: string;
  page: number;
  category: string;
}

export type GapStatus = 'FULL' | 'PARTIAL' | 'MISSING';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Citation {
  clauseRef: string;
  page: number;
}

export interface GapVerdict {
  requirement: Requirement;
  status: GapStatus;
  severity: Severity;
  standardCitation: Citation;
  procedureCitation: Citation | null;
  evidenceQuote: string;
  rationale: string;
  recommendedAction: string;
}

export interface GapReport {
  standardDocId: string;
  procedureDocId: string;
  coverageScore: number; // % of requirements FULL
  counts: Record<GapStatus, number>;
  matrix: GapVerdict[];
}
