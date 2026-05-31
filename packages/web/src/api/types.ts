/** API types mirroring the server's domain model (ARCHITECTURE.md §10). */

export type DocType = 'standard' | 'procedure';
export type GapStatus = 'FULL' | 'PARTIAL' | 'MISSING';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

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
  subDocuments?: SubDocument[];
  summary?: string;
  keyPoints?: KeyPoint[];
}

export interface DocumentDetail extends DocumentRecord {
  summary: string;
  keyPoints: KeyPoint[];
}

export interface ChunkMetadata {
  docId: string;
  docType: DocType;
  subDocId?: string;
  sectionPath: string[];
  clauseRef: string;
  headingTrail: string;
  page: number;
  charRange: [number, number];
}

export interface Chunk {
  id: string;
  text: string;
  metadata: ChunkMetadata;
}

export interface Citation {
  clauseRef: string;
  page: number;
}

export interface QASource {
  chunkId: string;
  clauseRef: string;
  page: number;
  subDocId?: string;
  excerpt: string;
  score: number;
}

export interface QAResult {
  answer: string;
  sources: QASource[];
}

export interface Requirement {
  id: string;
  text: string;
  clauseRef: string;
  page: number;
  category: string;
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
  coverageScore: number;
  counts: Record<GapStatus, number>;
  matrix: GapVerdict[];
}

export interface Session {
  token: string;
  username: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
