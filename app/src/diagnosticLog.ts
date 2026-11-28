import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type LogLevel = 'info' | 'ok' | 'warn' | 'error';
/** Только диагностические сообщения. Никогда не передавать конфигурацию, HTTP-ответы или Error целиком. */
export class DiagnosticLog {
  private readonly session = randomUUID();
  private failed = false;
  private readonly file: string;
  constructor(private readonly dir: string, private readonly secrets: () => string[] = () => [], private readonly maxBytes = 1024 * 1024) {
    this.file = join(dir, 'screensaver.jsonl');
  }
  private clean(text: string): string {
    for (const value of this.secrets().filter(Boolean).sort((a, b) => b.length - a.length)) text = text.split(value).join('[скрыто]');
    return text.replace(/https?:\/\/[^\s"<>]+/gi, '[адрес скрыт]')
      .replace(/(?:ApiKey|AccessToken|password|Authorization)\s*[:=]\s*[^\s,;]+/gi, '[секрет скрыт]')
      .replace(/[\r\n\x00-\x1f]/g, ' ').slice(0, 4000);
  }
  write(event: string, text = '', level: LogLevel = 'info', attempt?: string): void {
    try {
      mkdirSync(this.dir, { recursive: true });
      const line = JSON.stringify({ time: new Date().toISOString(), session: this.session, event: this.clean(event), level, attempt, text: this.clean(text) }) + '\n';
      if (existsSync(this.file) && statSync(this.file).size + Buffer.byteLength(line) > this.maxBytes) {
        rmSync(this.file + '.2', { force: true });
        if (existsSync(this.file + '.1')) renameSync(this.file + '.1', this.file + '.2');
        renameSync(this.file, this.file + '.1');
      }
      appendFileSync(this.file, line, { encoding: 'utf8', mode: 0o600 });
    } catch { this.failed = true; } // Ошибка диска не должна мешать работе и выходу из киоска.
  }
  report(version: string): string {
    const parts = [`MaximaKiosk ${version} — диагностика заставки`, `Выгружено: ${new Date().toISOString()}. Время событий — UTC.`,
      'Журнал локальный. Серверные ответы, PIN, пароли, токены и адреса потоков не записываются.'];
    if (this.failed) parts.push('ВНИМАНИЕ: часть событий не записана из-за ошибки доступа к диску.');
    for (const suffix of ['.2', '.1', '']) {
      const file = this.file + suffix;
      try { if (existsSync(file)) parts.push(readFileSync(file, 'utf8')); }
      catch { parts.push('ВНИМАНИЕ: часть журнала не удалось прочитать.'); }
    }
    return parts.join('\n\n');
  }
  exportTo(file: string, version: string): void {
    // Сохранение выполняется только после диалога выбора файла в авторизованном сервисном окне.
    writeFileSync(file, '\ufeff' + this.report(version), { encoding: 'utf8', mode: 0o600 });
  }
}
