import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { screensaverSchema, type Screensaver } from '../../src/data/schema';

export type { Screensaver };

function readCache(path: string): Screensaver | null {
  try {
    return screensaverSchema.parse(JSON.parse(readFileSync(path, 'utf-8')));
  } catch {
    return null;
  }
}

/**
 * Настройки заставки из админки (data/screensaver.json на сервере стенда).
 * Сеть или ответ подвели — последние удачные из cachePath; нет и их — null (заставки нет).
 */
export async function fetchScreensaverSettings(fetchImpl: typeof fetch, url: string, cachePath: string): Promise<Screensaver | null> {
  try {
    const res = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return readCache(cachePath);
    const parsed = screensaverSchema.safeParse(await res.json());
    if (!parsed.success) return readCache(cachePath);
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(parsed.data));
    return parsed.data;
  } catch {
    return readCache(cachePath);
  }
}
