import type { EditableFile } from '../../../src/data/schema';
import type { CoverageRow } from '../../../src/legal/coverage';

export interface Issue {
  path: string;
  message: string;
}
export interface HistoryEntry {
  id: string;
  at: string;
  user: string;
  file: EditableFile;
}

export class ApiValidationError extends Error {
  constructor(public readonly issues: Issue[]) {
    super('Есть ошибки — исправьте отмеченные поля');
  }
}
export class ApiConflictError extends Error {}
export class ApiAuthError extends Error {}

const BASE = `${import.meta.env.BASE_URL}api/`;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, { credentials: 'same-origin', ...init });
  const body = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  const error = (body as { error?: string } | undefined)?.error;
  if (res.status === 401) throw new ApiAuthError(error ?? 'Нужно войти');
  if (res.status === 409) throw new ApiConflictError(error ?? 'Данные изменились — обновите страницу');
  if (res.status === 422) throw new ApiValidationError((body as { issues: Issue[] }).issues);
  if (!res.ok) throw new Error(error ?? `Ошибка сервера (${res.status})`);
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(data),
});

export const api = {
  me: () => call<{ login: string }>('me'),
  login: (login: string, password: string) => call<void>('login', json('POST', { login, password })),
  logout: () => call<void>('logout', { method: 'POST' }),
  getContent: <T>(file: EditableFile) => call<{ data: T; version: string }>(`content/${file}`),
  putContent: (file: EditableFile, data: unknown, baseVersion: string) =>
    call<{ version: string }>(`content/${file}`, json('PUT', { data, baseVersion })),
  upload: async (kind: 'pdf' | 'photo', file: File, hint: string) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return (await call<{ file: string }>(`upload/${kind}?hint=${encodeURIComponent(hint)}`, { method: 'POST', body: form })).file;
  },
  history: () => call<HistoryEntry[]>('history'),
  restore: (id: string) => call<void>(`history/${id}/restore`, { method: 'POST' }),
  coverage: () => call<CoverageRow[]>('coverage'),
};
