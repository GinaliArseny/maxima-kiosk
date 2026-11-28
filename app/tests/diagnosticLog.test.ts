import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { DiagnosticLog } from '../src/diagnosticLog';
const dirs: string[] = [];
const dir = () => { const d = mkdtempSync(join(tmpdir(), 'kiosk-log-')); dirs.push(d); return d; };
afterEach(() => dirs.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })));

it('журнал переживает перезапуск и сохраняет время, сессию и вид запуска', () => {
  const d = dir();
  new DiagnosticLog(d).write('saver.start', 'Ручная проверка', 'info', 'manual-1');
  const log = new DiagnosticLog(d);
  log.write('saver.start', 'Автоматический запуск', 'info', 'auto-1');
  const lines = readFileSync(join(d, 'screensaver.jsonl'), 'utf8').trim().split('\n').map(s => JSON.parse(s));
  expect(lines[0].session).not.toBe(lines[1].session);
  expect(Date.parse(lines[0].time)).toBeGreaterThan(0);
  expect(lines.map(l => l.attempt)).toEqual(['manual-1', 'auto-1']);
  expect(log.report('0.2.1')).toContain('Ручная проверка');
});
it('секреты и адреса не попадают в файл или экспорт', () => {
  const d = dir(); const log = new DiagnosticLog(d, () => ['private-password', 'private-hash']);
  log.write('error', 'private-password private-hash https://server/stream?ApiKey=token-123 ApiKey=token456 AccessToken=token789 password=qwerty\nподдельная строка');
  const report = log.report('0.2.1');
  expect(report).not.toMatch(/private-password|private-hash|token-123|token456|token789|qwerty|https:\/\/server/);
  expect(readFileSync(join(d, 'screensaver.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
});
it('ротация ограничивает объём тремя файлами и сохраняет последние события', () => {
  const d = dir(); const log = new DiagnosticLog(d, () => [], 500);
  for (let i = 0; i < 30; i++) log.write('event', `номер ${i} ` + 'x'.repeat(100));
  const files = readdirSync(d);
  expect(files).toHaveLength(3);
  for (const f of files) expect(statSync(join(d, f)).size).toBeLessThanOrEqual(500);
  const report = log.report('0.2.1');
  expect(report).toContain('номер 29'); expect(report).not.toContain('номер 0 ');
  expect(report.indexOf('номер 28')).toBeLessThan(report.indexOf('номер 29'));
});
it('ошибка записи не ломает программу, а неполный отчёт помечен', () => {
  const blocked = join(dir(), 'not-a-directory'); writeFileSync(blocked, 'x');
  const log = new DiagnosticLog(blocked);
  expect(() => log.write('event')).not.toThrow();
  expect(log.report('0.2.1')).toContain('часть событий не записана');
});
it('экспорт — UTF-8 TXT с версией, событиями и без конфигурации', () => {
  const d = dir(); const log = new DiagnosticLog(join(d, 'logs'));
  log.write('saver.playback.error', 'Ошибка декодирования', 'error', 'auto-1');
  const target = join(d, 'report.txt'); log.exportTo(target, '0.2.1');
  const report = readFileSync(target, 'utf8');
  expect(report.charCodeAt(0)).toBe(0xfeff);
  expect(report).toContain('MaximaKiosk 0.2.1'); expect(report).toContain('Ошибка декодирования');
  expect(() => log.exportTo(join(d, 'missing', 'report.txt'), '0.2.1')).toThrow();
});
it('слишком длинное сообщение ограничено', () => {
  const d = dir(); const log = new DiagnosticLog(d);
  log.write('event', 'x'.repeat(100000));
  const entry = JSON.parse(readFileSync(join(d, 'screensaver.jsonl'), 'utf8'));
  expect(entry.text).toHaveLength(4000);
});
