import { fileSchemas, type KioskData } from './schema';

type DataFile = keyof typeof fileSchemas;

/** Ошибка загрузки или валидации конкретного файла данных. */
export class DataError extends Error {
  constructor(
    public readonly file: string,
    message: string,
  ) {
    super(`${file}: ${message}`);
    this.name = 'DataError';
  }
}

async function loadFile<F extends DataFile>(fetchImpl: typeof fetch, base: string, file: F) {
  let raw: unknown;
  try {
    const res = await fetchImpl(base + file, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (e) {
    throw new DataError(file, e instanceof Error ? e.message : String(e));
  }
  const parsed = fileSchemas[file].safeParse(raw);
  if (!parsed.success) throw new DataError(file, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return parsed.data;
}

/** Загружает и валидирует все файлы данных киоска. */
export async function loadKioskData(fetchImpl: typeof fetch = fetch, base = './data/'): Promise<KioskData> {
  const [clinic, doctors, sections, authorities] = await Promise.all([
    loadFile(fetchImpl, base, 'clinic.json'),
    loadFile(fetchImpl, base, 'doctors.json'),
    loadFile(fetchImpl, base, 'documents.json'),
    loadFile(fetchImpl, base, 'authorities.json'),
  ]);
  return { clinic, doctors, sections, authorities } as KioskData;
}
