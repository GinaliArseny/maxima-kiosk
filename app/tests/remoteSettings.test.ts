import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fetchScreensaverSettings } from '../src/remoteSettings';

const URL_ = 'https://kiosk.339933.net/data/screensaver.json';
const good = { enabled: true, idleMinutes: 3, muted: true, sources: [{ itemId: 'aaaabbbbccccddddeeeeffff00001111' }] };
const cache = () => join(mkdtempSync(join(tmpdir(), 'ss-')), 'cache.json');
/** Сервер стенда — граница сети. */
const serve = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const down = (async () => {
  throw new TypeError('fetch failed');
}) as unknown as typeof fetch;

describe('Настройки заставки с сервера', () => {
  it('сервер ответил — настройки берутся и запоминаются', async () => {
    const c = cache();
    expect(await fetchScreensaverSettings(serve(good), URL_, c)).toEqual(good);
    expect(await fetchScreensaverSettings(down, URL_, c), 'сеть упала — из запомненного').toEqual(good);
  });

  it('невалидный ответ — берётся запомненное', async () => {
    const c = cache();
    writeFileSync(c, JSON.stringify(good));
    expect(await fetchScreensaverSettings(serve({ enabled: 'да' }), URL_, c)).toEqual(good);
  });

  it('файла ещё нет на сервере (404) и нет запомненного — null, заставки нет', async () => {
    expect(await fetchScreensaverSettings(serve('nf', 404), URL_, cache())).toBeNull();
  });
});
