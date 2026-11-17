import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const pub = resolve(__dirname, '../../public');

/** Временный каталог контента, засеянный боевыми данными киоска из public/. */
export function makeContentRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'kiosk-content-'));
  for (const d of ['data', 'docs', 'doctors']) cpSync(join(pub, d), join(root, d), { recursive: true });
  return root;
}

export const readJson = <T = unknown>(root: string, file: string): T =>
  JSON.parse(readFileSync(join(root, 'data', file), 'utf-8')) as T;
