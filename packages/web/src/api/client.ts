import type {
  ApiErrorBody,
  Chunk,
  DocType,
  DocumentDetail,
  DocumentRecord,
  GapReport,
  QAResult,
  QASource,
  Session,
} from './types';

/**
 * Typed API client. Base URL from `VITE_API_URL`; the bearer token (mock,
 * identification-only) is held in memory and attached to every request.
 */
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}`, ...extra } : extra;
}

async function toError(res: Response): Promise<ApiError> {
  let code = 'HTTP_ERROR';
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body?.error) {
      code = body.error.code;
      message = body.error.message;
    }
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(res.status, code, message);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) throw await toError(res);
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res);
  return (await res.json()) as T;
}

export const api = {
  baseUrl: API_URL,

  login(username: string, password: string): Promise<Session> {
    return postJson<Session>('/auth/login', { username, password });
  },

  listDocuments(): Promise<DocumentRecord[]> {
    return getJson<DocumentRecord[]>('/documents');
  },

  getDocument(id: string): Promise<DocumentDetail> {
    return getJson<DocumentDetail>(`/documents/${encodeURIComponent(id)}`);
  },

  getChunks(id: string): Promise<Chunk[]> {
    return getJson<Chunk[]>(`/documents/${encodeURIComponent(id)}/chunks`);
  },

  /** Upload with progress (XHR — fetch has no upload progress event). */
  uploadDocument(
    input: { file: File; title: string; docType: DocType },
    onProgress?: (fraction: number) => void,
  ): Promise<DocumentRecord> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('file', input.file);
      form.append('title', input.title);
      form.append('docType', input.docType);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/documents`);
      if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText) as DocumentRecord);
        } else {
          try {
            const body = JSON.parse(xhr.responseText) as ApiErrorBody;
            reject(new ApiError(xhr.status, body.error?.code ?? 'HTTP_ERROR', body.error?.message ?? 'Upload failed'));
          } catch {
            reject(new ApiError(xhr.status, 'HTTP_ERROR', 'Upload failed'));
          }
        }
      };
      xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', 'Network error during upload'));
      xhr.send(form);
    });
  },

  ask(docId: string, question: string): Promise<QAResult> {
    return postJson<QAResult>(`/documents/${encodeURIComponent(docId)}/qa`, { question });
  },

  gapAnalysis(standardDocId: string, procedureDocId: string): Promise<GapReport> {
    return postJson<GapReport>('/gap-analysis', { standardDocId, procedureDocId });
  },

  /**
   * Streaming Q&A (SSE over POST). Calls `onSources` once, then `onToken` per
   * delta. Returns when the stream ends. (Wired up fully in the chat phase.)
   */
  async askStream(
    docId: string,
    question: string,
    handlers: { onSources?: (s: QASource[]) => void; onToken?: (t: string) => void; signal?: AbortSignal },
  ): Promise<void> {
    const res = await fetch(`${API_URL}/documents/${encodeURIComponent(docId)}/qa/stream`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ question }),
      signal: handlers.signal,
    });
    if (!res.ok || !res.body) throw await toError(res);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const block of events) {
        const event = /event: (.*)/.exec(block)?.[1];
        const data = /data: (.*)/s.exec(block)?.[1];
        if (!event || data === undefined) continue;
        if (event === 'sources') handlers.onSources?.(JSON.parse(data) as QASource[]);
        else if (event === 'token') handlers.onToken?.(JSON.parse(data) as string);
      }
    }
  },
};
