import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EDITABLE_FILES, type EditableFile, type KioskData } from '../../src/data/schema';
import { computeCoverage, type CoverageRow } from '../../src/legal/coverage';
import { ValidationError, validateAll } from './validate';

export { ValidationError } from './validate';
export type { Issue } from './validate';

export class ConflictError extends Error {
  constructor() {
    super('Данные изменились — обновите страницу');
    this.name = 'ConflictError';
  }
}

export interface HistoryEntry {
  id: string;
  at: string;
  user: string;
  file: EditableFile;
}
interface Snapshot extends HistoryEntry {
  files: Record<EditableFile, unknown>;
}

const FILES = Object.keys(EDITABLE_FILES) as EditableFile[];

/** Файлы, которых может не быть на сервере (появились после первой выкладки), и их значение по умолчанию. */
const DEFAULTS: Partial<Record<EditableFile, unknown>> = {
  'screensaver.json': { enabled: false, idleMinutes: 3, muted: true, sources: [] },
};
const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 12);
const serialize = (data: unknown) => JSON.stringify(data, null, 2) + '\n';

/** Атомарная запись: читатель (nginx → киоск) никогда не видит полузаписанный файл. */
async function writeAtomic(path: string, text: string) {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, text);
  await rename(tmp, path);
}

/**
 * Файлы контента киоска на сервере: root/{data,docs,doctors,history}.
 * Сохранение = публикация: проверка → атомарная запись → снимок в историю → version.json.
 */
export class ContentStore {
  private readonly historyLimit: number;
  private readonly now: () => Date;
  private seq = 0;
  /** Сохранения выполняются строго по одному — проверка версии и запись не перемежаются. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly root: string,
    opts: { historyLimit?: number; now?: () => Date } = {},
  ) {
    this.historyLimit = opts.historyLimit ?? 500;
    this.now = opts.now ?? (() => new Date());
  }

  private path = (file: string) => join(this.root, 'data', file);

  async read(file: EditableFile): Promise<{ data: unknown; version: string }> {
    const path = this.path(file);
    const text = !existsSync(path) && file in DEFAULTS ? serialize(DEFAULTS[file]) : await readFile(path, 'utf-8');
    return { data: JSON.parse(text), version: hash(text) };
  }

  /** При запуске: нет data/version.json — создать, чтобы киоск взял эталон до первой правки. */
  async ensureVersion(): Promise<void> {
    const path = this.path('version.json');
    if (existsSync(path)) return;
    await writeAtomic(path, JSON.stringify({ version: `initial-${this.now().toISOString()}` }) + '\n');
  }

  private async readAll(): Promise<Record<EditableFile, unknown>> {
    const entries = await Promise.all(FILES.map(async (f) => [f, (await this.read(f)).data] as const));
    return Object.fromEntries(entries) as Record<EditableFile, unknown>;
  }

  private async existing() {
    const list = async (dir: string) => (existsSync(join(this.root, dir)) ? await readdir(join(this.root, dir)) : []);
    return {
      docs: new Set(await list('docs')),
      photos: new Set((await list('doctors')).map((f) => `doctors/${f}`)),
    };
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Проверяет и пишет набор файлов целиком, кладёт снимок в историю. */
  private async publish(files: Record<EditableFile, unknown>, changed: EditableFile[], user: string, file: EditableFile) {
    const issues = validateAll(files, await this.existing());
    if (issues.length) throw new ValidationError(issues);
    for (const f of changed) await writeAtomic(this.path(f), serialize(EDITABLE_FILES[f].parse(files[f])));

    const at = this.now().toISOString();
    const id = `${at.replace(/[:.]/g, '-')}-${String(++this.seq).padStart(6, '0')}`;
    const snapshot: Snapshot = { id, at, user, file, files: await this.readAll() };
    await mkdir(join(this.root, 'history'), { recursive: true });
    await writeAtomic(join(this.root, 'history', `${id}.json`), JSON.stringify(snapshot));
    await writeAtomic(this.path('version.json'), JSON.stringify({ version: id }) + '\n');
    await this.prune();
  }

  save(file: EditableFile, data: unknown, baseVersion: string, user: string): Promise<{ version: string }> {
    return this.serial(async () => {
      if ((await this.read(file)).version !== baseVersion) throw new ConflictError();
      const files = { ...(await this.readAll()), [file]: data };
      await this.publish(files, [file], user, file);
      return { version: (await this.read(file)).version };
    });
  }

  private async ids(): Promise<string[]> {
    const dir = join(this.root, 'history');
    if (!existsSync(dir)) return [];
    return (await readdir(dir))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .sort()
      .reverse();
  }

  private async prune() {
    for (const id of (await this.ids()).slice(this.historyLimit)) await rm(join(this.root, 'history', `${id}.json`));
  }

  private async snapshot(id: string): Promise<Snapshot> {
    if (!/^[\w-]+$/.test(id)) throw new Error('bad id');
    return JSON.parse(await readFile(join(this.root, 'history', `${id}.json`), 'utf-8')) as Snapshot;
  }

  /** Новые сверху. */
  async history(): Promise<HistoryEntry[]> {
    return Promise.all(
      (await this.ids()).map(async (id) => {
        const { at, user, file } = await this.snapshot(id);
        return { id, at, user, file };
      }),
    );
  }

  restore(id: string, user: string): Promise<void> {
    return this.serial(async () => {
      const snap = await this.snapshot(id);
      await this.publish(snap.files, FILES, user, snap.file);
    });
  }

  async coverage(): Promise<CoverageRow[]> {
    const files = await this.readAll();
    const data = {
      clinic: files['clinic.json'],
      doctors: (files['doctors.json'] as KioskData['doctors']).filter((d) => !d.hidden),
      sections: files['documents.json'],
      authorities: files['authorities.json'],
    } as KioskData;
    return computeCoverage(data, (await this.existing()).docs);
  }
}
