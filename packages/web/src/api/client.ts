/**
 * Typed API client stub. Reads the backend base URL from `VITE_API_URL`.
 * Real endpoints (documents, summary, streaming Q&A, gap analysis) are added in
 * a later phase. See ARCHITECTURE.md §3.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export interface HealthResponse {
  status: string;
}

export const apiClient = {
  baseUrl: API_URL,

  // TODO: documents, summary, key points, Q&A (SSE), gap analysis.
  async health(): Promise<HealthResponse> {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }
    return (await res.json()) as HealthResponse;
  },
};
