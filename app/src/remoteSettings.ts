import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { screensaverSchema, type Screensaver } from '../../src/data/schema';
export type { Screensaver };
export interface SettingsResult { settings: Screensaver | null; source: 'server' | 'cache' | 'none'; note?: string }
function readCache(path: string): Screensaver | null {
  try { return screensaverSchema.parse(JSON.parse(readFileSync(path, 'utf-8'))); } catch { return null; }
}
export async function loadScreensaverSettings(fetchImpl: typeof fetch, url: string, cachePath: string): Promise<SettingsResult> {
  let note = 'Сервер настроек недоступен. Проверьте подключение к интернету.';
  try {
    const res = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const parsed = screensaverSchema.safeParse(await res.json());
      if (parsed.success) {
        try {
          mkdirSync(dirname(cachePath), { recursive: true });
          writeFileSync(cachePath, JSON.stringify(parsed.data));
          return { settings: parsed.data, source: 'server' };
        } catch {
          return { settings: parsed.data, source: 'server', note: 'Настройки получены, но локальную копию сохранить не удалось. Проверьте права записи.' };
        }
      }
      note = 'Сервер вернул неверный формат настроек заставки. Сохраните раздел «Заставка» в веб-админке.';
    } else {
      note = res.status === 404 ? 'Настройки заставки ещё не опубликованы (404). Сохраните раздел «Заставка» в веб-админке.' : `Сервер настроек ответил HTTP ${res.status}.`;
    }
  } catch { /* без сырых сетевых ошибок и URL в отчёте */ }
  const settings = readCache(cachePath);
  return { settings, source: settings ? 'cache' : 'none', note };
}
export async function fetchScreensaverSettings(fetchImpl: typeof fetch, url: string, cachePath: string): Promise<Screensaver | null> {
  return (await loadScreensaverSettings(fetchImpl, url, cachePath)).settings;
}
