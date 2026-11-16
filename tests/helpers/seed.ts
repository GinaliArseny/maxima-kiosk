import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const DATA_FILES = ['clinic.json', 'doctors.json', 'documents.json', 'authorities.json'] as const;
export type DataFile = (typeof DATA_FILES)[number];

/** Сырые сид-данные из public/data — тот же JSON, что получит киоск. */
export function readSeed(): Record<DataFile, unknown> {
  const dir = resolve(__dirname, '../../public/data');
  return Object.fromEntries(
    DATA_FILES.map((f) => [f, JSON.parse(readFileSync(resolve(dir, f), 'utf-8'))]),
  ) as Record<DataFile, unknown>;
}

export interface FakeFetchOptions {
  /** Подмена содержимого отдельных файлов. */
  files?: Partial<Record<DataFile, unknown>>;
  /** Файлы, на которых fetch падает сетевой ошибкой. */
  failFiles?: string[];
}

/** Фейковый fetch — граница сети: отдаёт сид по имени файла из URL. */
export function makeFakeFetch(opts: FakeFetchOptions = {}): typeof fetch {
  const seed = readSeed();
  const failing = new Set(opts.failFiles ?? []);
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const name = url.split('/').pop()!.split('?')[0] as DataFile;
    if (failing.has(name)) throw new TypeError('Failed to fetch');
    if (!(name in seed)) return new Response('not found', { status: 404 });
    const body = opts.files?.[name] ?? seed[name];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}
