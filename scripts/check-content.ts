/**
 * Проверка контента киоска: валидирует public/data/*.json, проверяет PDF
 * и печатает таблицу 28 пунктов требований. Exit 1 — невалидные данные или дыра.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileSchemas, type KioskData } from '../src/data/schema';
import { computeCoverage, type CoverageStatus } from '../src/legal/coverage';

const root = resolve(import.meta.dirname, '..');
const dataDir = resolve(root, 'public/data');
const docsDir = resolve(root, 'public/docs');

let failed = false;
const parsed: Record<string, unknown> = {};
for (const [file, schema] of Object.entries(fileSchemas)) {
  try {
    const res = schema.safeParse(JSON.parse(readFileSync(resolve(dataDir, file), 'utf-8')));
    if (!res.success) {
      failed = true;
      console.error(`✗ ${file}:`);
      res.error.issues.forEach((i) => console.error(`    ${i.path.join('.') || '(корень)'}: ${i.message}`));
    } else parsed[file] = res.data;
  } catch (e) {
    failed = true;
    console.error(`✗ ${file}: ${(e as Error).message}`);
  }
}
if (failed) {
  console.error('\nДанные невалидны — таблица покрытия не строится.');
  process.exit(1);
}

const data: KioskData = {
  clinic: parsed['clinic.json'] as KioskData['clinic'],
  doctors: parsed['doctors.json'] as KioskData['doctors'],
  sections: parsed['documents.json'] as KioskData['sections'],
  authorities: parsed['authorities.json'] as KioskData['authorities'],
};
const files = new Set(existsSync(docsDir) ? readdirSync(docsDir) : []);

for (const s of data.sections)
  for (const i of s.items)
    if (i.kind === 'pdf' && !files.has(i.file)) console.warn(`⚠ PDF не найден: public/docs/${i.file} (элемент «${i.title}»)`);

const label: Record<CoverageStatus, string> = {
  covered: '✓ закрыт',
  missing: '✗ НЕ ЗАКРЫТ',
  'n/a': '— неприменим к стенду',
  conditional: '○ по событию (баннер)',
};
const rows = computeCoverage(data, files);
console.log('\n №  | статус                  | пункт');
console.log('----+-------------------------+' + '-'.repeat(60));
for (const r of rows) console.log(`${String(r.n).padStart(3)} | ${label[r.status].padEnd(23)} | ${r.title}`);

const missing = rows.filter((r) => r.status === 'missing');
if (data.clinic.demo) console.warn('\n⚠ clinic.demo = true — на киоске показывается лента «ДЕМО-ДАННЫЕ». Перед запуском заменить данные и убрать флаг.');
if (missing.length) {
  console.error(`\n✗ Не закрыто пунктов: ${missing.length} (${missing.map((r) => r.n).join(', ')})`);
  process.exit(1);
}
console.log('\n✓ Все пункты стенда закрыты.');
