import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig, saveConfig } from '../src/config';

const dir = () => mkdtempSync(join(tmpdir(), 'kiosk-cfg-'));

describe('Локальный конфиг программы-киоска', () => {
  it('нет файла — адрес киоска по умолчанию, PIN не задан', () => {
    const cfg = loadConfig(join(dir(), 'config.json'));
    expect(cfg.kioskUrl).toBe('https://kiosk.339933.net/');
    expect(cfg.pinHash).toBeUndefined();
  });

  it('битый JSON — значения по умолчанию, программа не падает', () => {
    const p = join(dir(), 'config.json');
    writeFileSync(p, '{ не json');
    expect(loadConfig(p).kioskUrl).toBe('https://kiosk.339933.net/');
  });

  it('сохранённое читается обратно; каталог создаётся сам', () => {
    const p = join(dir(), 'MaximaKiosk', 'config.json');
    saveConfig(p, {
      kioskUrl: 'https://kiosk.339933.net/',
      pinHash: 'scrypt$aa$bb',
      jellyfin: { internalUrl: 'http://192.168.1.10:8096', user: 'kiosk', password: 'секрет' },
    });
    expect(loadConfig(p).jellyfin?.user).toBe('kiosk');
    expect(JSON.parse(readFileSync(p, 'utf-8')).pinHash).toBe('scrypt$aa$bb');
  });
});
