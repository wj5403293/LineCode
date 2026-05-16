import type { ArtifactInspection, LanzouSettings, ReleaseRecord, SummaryData } from './types';

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  errors?: string[];
}

export class ApiError extends Error {
  status: number;
  errors: string[];

  constructor(message: string, status: number, errors: string[] = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const json = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok || !json.ok) {
    throw new ApiError(json.error || `HTTP ${response.status}`, response.status, json.errors || []);
  }
  return json.data as T;
}

function post<T>(path: string, body: unknown = {}): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export const api = {
  login(password: string) {
    return post<void>('/api/auth/login', { password });
  },
  logout() {
    return post<void>('/api/auth/logout');
  },
  me() {
    return request<{ user: { role: string } }>('/api/auth/me');
  },
  summary() {
    return request<SummaryData>('/api/summary');
  },
  connectLanzou(cookie: string, folderId: number) {
    return post<LanzouSettings>('/api/lanzou/connect', { cookie, folderId });
  },
  testLanzou(folderId: number, cookie?: string) {
    return post<LanzouSettings>('/api/lanzou/test', { folderId, cookie });
  },
  scanRelease(artifactDir: string) {
    return post<ArtifactInspection>('/api/releases/scan', { artifactDir });
  },
  publishRelease(input: { artifactDir: string; uploadToLanzou: boolean; makeActive: boolean }) {
    return post<ReleaseRecord>('/api/releases/publish', input);
  },
  activateRelease(id: string) {
    return post<ReleaseRecord>(`/api/releases/${encodeURIComponent(id)}/activate`);
  },
  deleteRelease(id: string, deleteCloud: boolean) {
    return request<ReleaseRecord>(`/api/releases/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ deleteCloud }),
      headers: { 'content-type': 'application/json' },
    });
  },
};
