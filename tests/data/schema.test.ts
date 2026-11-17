import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDITABLE_FILES, screensaverSchema } from '../../src/data/schema';

const seed = JSON.parse(readFileSync(resolve(__dirname, '../../public/data/screensaver.json'), 'utf-8'));

describe('Схема настроек заставки', () => {
  it('стартовый screensaver.json валиден и заставка в нём выключена', () => {
    const parsed = screensaverSchema.parse(seed);
    expect(parsed.enabled).toBe(false);
    expect(parsed.idleMinutes).toBe(3);
  });

  it('порог простоя 0 минут не принимается', () => {
    expect(screensaverSchema.safeParse({ ...seed, idleMinutes: 0 }).success).toBe(false);
  });

  it('источник — только ID элемента Jellyfin (32 hex), не ссылка и не мусор', () => {
    expect(screensaverSchema.safeParse({ ...seed, sources: [{ itemId: 'abc' }] }).success).toBe(false);
    expect(screensaverSchema.safeParse({ ...seed, sources: [{ itemId: '18317a37f31a2c3bb9ca6cd7d0054d6e' }] }).success).toBe(true);
  });

  it('админка правит пять файлов: четыре файла киоска и заставку', () => {
    expect(Object.keys(EDITABLE_FILES).sort()).toEqual(
      ['authorities.json', 'clinic.json', 'doctors.json', 'documents.json', 'screensaver.json'],
    );
  });
});
