import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dist = resolve(__dirname, '../../dist');
const built = existsSync(resolve(dist, 'index.html'));

/** Проверяет результат `npm run build`; без сборки пропускается. */
describe('Сборка не содержит данных киоска', () => {
  it.skipIf(!built)('в dist нет data/, docs/, doctors/ — выкладка не затрёт правки админки', () => {
    for (const d of ['data', 'docs', 'doctors']) expect(existsSync(resolve(dist, d)), d).toBe(false);
  });

  it.skipIf(!built)('service worker не подменяет страницы админки', () => {
    expect(readFileSync(resolve(dist, 'sw.js'), 'utf-8')).toMatch(/\\\/admin/);
  });
});
