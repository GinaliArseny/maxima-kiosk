import { describe, expect, it } from 'vitest';
import { createPlaylistCursor, JellyfinClient } from '../src/jellyfin';

// Выдуманный сервер Jellyfin — граница сети. Значения ID условные.
const PL = 'a'.repeat(32);
const FOLDER = 'b'.repeat(32);
const V1 = '1'.repeat(32);
const V2 = '2'.repeat(32);
const V3 = '3'.repeat(32);
const PHOTO = '4'.repeat(32);
const SONG = '5'.repeat(32);

const items: Record<string, { Id: string; Type: string; Name: string }> = {
  [PL]: { Id: PL, Type: 'Playlist', Name: 'Заставка киоска' },
  [FOLDER]: { Id: FOLDER, Type: 'Folder', Name: 'Ролики' },
  [V1]: { Id: V1, Type: 'Video', Name: 'Приветствие' },
  [V2]: { Id: V2, Type: 'Movie', Name: 'О клинике' },
  [V3]: { Id: V3, Type: 'Episode', Name: 'Вертикальное' },
  [PHOTO]: { Id: PHOTO, Type: 'Photo', Name: 'Фото' },
  [SONG]: { Id: SONG, Type: 'Audio', Name: 'Песня' },
};

function server(opts: { up?: string[]; expireTokenOnce?: boolean } = {}) {
  const up = new Set(opts.up ?? ['http://jf.local:8096']);
  const calls: string[] = [];
  let tokenValid = true;
  let expired = !opts.expireTokenOnce;
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push(`${init.method ?? 'GET'} ${url.pathname}${url.search}`);
    if (!up.has(url.origin)) throw new TypeError('fetch failed');
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
    if (url.pathname === '/System/Info/Public') return json({ ServerName: 'test' });
    if (url.pathname === '/Users/AuthenticateByName') {
      const body = JSON.parse(String(init.body));
      if (body.Username !== 'kiosk' || body.Pw !== 'pw') return json({}, 401);
      tokenValid = true;
      return json({ AccessToken: 'tok', User: { Id: 'uid' } });
    }
    const auth = new Headers(init.headers).get('Authorization') ?? '';
    if (!auth.includes('Token="tok"') || !tokenValid) return json({}, 401);
    if (!expired) {
      expired = true;
      tokenValid = false;
      return json({}, 401);
    }
    if (url.pathname === '/Items' && url.searchParams.get('ids'))
      return json({ Items: [items[url.searchParams.get('ids')!]].filter(Boolean) });
    if (url.pathname === `/Playlists/${PL}/Items`) return json({ Items: [items[V1], items[PHOTO], items[V2]] });
    if (url.pathname === '/Items' && url.searchParams.get('ParentId') === FOLDER) return json({ Items: [items[V3], items[SONG]] });
    return json({}, 404);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const client = (s: ReturnType<typeof server>, extra: Partial<ConstructorParameters<typeof JellyfinClient>[0]> = {}) =>
  new JellyfinClient({ internalUrl: 'http://jf.local:8096', externalUrl: 'https://video.example.ru', user: 'kiosk', password: 'pw', fetch: s.fetchImpl, ...extra });

describe('Jellyfin для заставки', () => {
  it('внутренний адрес доступен — работаем через него', async () => {
    const c = client(server());
    expect(await c.resolveBase()).toBe('http://jf.local:8096');
  });

  it('внутренний недоступен — через внешний', async () => {
    const c = client(server({ up: ['https://video.example.ru'] }));
    expect(await c.resolveBase()).toBe('https://video.example.ru');
  });

  it('оба недоступны — ошибка (заставка не включается)', async () => {
    await expect(client(server({ up: [] })).resolveBase()).rejects.toThrow();
  });

  it('плейлист раскрывается в видео по порядку; фото и аудио пропускаются', async () => {
    const c = client(server());
    await c.resolveBase();
    await c.login();
    expect((await c.expand([PL])).map((i) => i.name)).toEqual(['Приветствие', 'О клинике']);
  });

  it('папка раскрывается рекурсивно, отдельное видео — само по себе; порядок как в настройках', async () => {
    const c = client(server());
    await c.resolveBase();
    await c.login();
    expect((await c.expand([V2, FOLDER])).map((i) => i.id)).toEqual([V2, V3]);
  });

  it('удалённый в Jellyfin элемент пропускается без ошибки', async () => {
    const c = client(server());
    await c.resolveBase();
    await c.login();
    expect((await c.expand(['f'.repeat(32), V1])).map((i) => i.id)).toEqual([V1]);
  });

  it('токен протух (401) — один повторный вход и успех', async () => {
    const s = server({ expireTokenOnce: true });
    const c = client(s);
    await c.resolveBase();
    await c.login();
    expect((await c.expand([V1])).map((i) => i.id)).toEqual([V1]);
    expect(s.calls.filter((x) => x.includes('AuthenticateByName'))).toHaveLength(2);
  });

  it('неверный пароль — понятная ошибка', async () => {
    const c = client(server(), { password: 'нет' });
    await c.resolveBase();
    await expect(c.login()).rejects.toThrow(/пароль/i);
  });

  it('ссылка на поток — с токеном сессии, без пароля', async () => {
    const c = client(server());
    await c.resolveBase();
    await c.login();
    const url = c.streamUrl(V1);
    expect(url).toBe(`http://jf.local:8096/Videos/${V1}/stream?static=true&ApiKey=tok`);
    expect(url).not.toContain('pw');
  });
});

describe('Очередь роликов заставки', () => {
  const a = { id: 'a', name: 'A' };
  const b = { id: 'b', name: 'B' };
  const c = { id: 'c', name: 'C' };

  it('идёт по кругу', () => {
    const q = createPlaylistCursor([a, b]);
    expect([q.next(), q.next(), q.next()].map((x) => x?.id)).toEqual(['a', 'b', 'a']);
  });

  it('сломанный ролик пропускается', () => {
    const q = createPlaylistCursor([a, b, c]);
    q.next();
    q.markBroken('b');
    expect([q.next(), q.next()].map((x) => x?.id)).toEqual(['c', 'a']);
  });

  it('все сломаны — null (заставка закрывается)', () => {
    const q = createPlaylistCursor([a, b]);
    q.markBroken('a');
    q.markBroken('b');
    expect(q.next()).toBeNull();
  });

  it('пустой список — null', () => {
    expect(createPlaylistCursor([]).next()).toBeNull();
  });
});
