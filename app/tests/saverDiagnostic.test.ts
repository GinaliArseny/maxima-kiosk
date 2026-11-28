import { describe, expect, it, vi } from 'vitest';
import { prepareSaver, playbackLine } from '../src/saverDiagnostic';
import type { SettingsResult } from '../src/remoteSettings';
const id = 'a'.repeat(32);
const settings = { enabled: true, idleMinutes: 1, muted: true, sources: [{ itemId: id }] };
const credentials = { internalUrl: 'http://jf.test', user: 'kiosk', password: 'test-password' };
function fakeServer(mode = 'ok'): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const u = new URL(String(input));
    if (mode === 'network') throw new Error('secret test-password URL ApiKey=SECRET');
    if (u.pathname === '/System/Info/Public') return Response.json({});
    if (u.pathname.includes('AuthenticateByName')) return mode === 'password' ? new Response('', { status: 401 }) : Response.json({ AccessToken: 'SECRET', User: { Id: 'u' } });
    if (mode === 'forbidden') return new Response('', { status: 403 });
    return Response.json({ Items: mode === 'empty' ? [] : [{ Id: id, Type: 'Video', Name: 'Ролик' }] });
  }) as typeof fetch;
}
const run = (mode = 'ok', overrides: Partial<Parameters<typeof prepareSaver>[0]> = {}) => prepareSaver({
  loadSettings: async () => ({ settings, source: 'server' }), jellyfin: credentials, fetch: fakeServer(mode), manual: true, ...overrides,
});
describe('Ручная проверка заставки', () => {
  it('получает реальные потоки без ожидания простоя', async () => {
    const r = await run(); expect(r.playlist?.test).toBe(true); expect(r.playlist?.items).toHaveLength(1);
    expect(r.report.some(x => x.text.includes('Вход в Jellyfin выполнен'))).toBe(true);
    expect(JSON.stringify(r.report)).not.toMatch(/SECRET|test-password|ApiKey/);
    expect(r.report.some(x => x.text.includes('Воспроизведение началось'))).toBe(false);
  });
  it('отключённый автозапуск не мешает ручному тесту, но мешает обычному', async () => {
    const loadSettings = async (): Promise<SettingsResult> => ({ settings: { ...settings, enabled: false }, source: 'server' });
    expect((await run('ok', { loadSettings })).playlist).toBeDefined();
    expect((await run('ok', { loadSettings, manual: false })).playlist).toBeUndefined();
  });
  it('404 настроек виден пользователю', async () => {
    const r = await run('ok', { loadSettings: async () => ({ settings: null, source: 'none', note: 'Настройки не опубликованы (404)' }) });
    expect(r.playlist).toBeUndefined(); expect(r.report.at(-1)).toEqual({ level: 'error', text: 'Настройки не опубликованы (404)' });
  });
  it('предупреждает об использовании локальной копии', async () => {
    const r = await run('ok', { loadSettings: async () => ({ settings, source: 'cache', note: 'Сеть недоступна' }) });
    expect(r.playlist).toBeDefined(); expect(r.report.some(x => x.level === 'warn' && x.text.includes('локальная'))).toBe(true);
  });
  it('пустые источники и отсутствующий доступ имеют разные объяснения', async () => {
    const a = await run('ok', { loadSettings: async () => ({ settings: { ...settings, sources: [] }, source: 'server' }) });
    const b = await run('ok', { jellyfin: undefined });
    expect(a.report.at(-1)?.text).toContain('Не выбрано'); expect(b.report.at(-1)?.text).toContain('Доступ к Jellyfin не настроен');
  });
  it.each([['password', 'пароль'], ['forbidden', '403'], ['empty', 'Видео не найдены'], ['network', 'недоступен']])('диагностирует %s без секретов', async (mode, expected) => {
    const r = await run(mode); expect(r.playlist).toBeUndefined(); expect(r.report.at(-1)?.level).toBe('error');
    expect(r.report.at(-1)?.text).toContain(expected); expect(JSON.stringify(r.report)).not.toMatch(/SECRET|test-password|ApiKey/);
  });
  it('передаёт промежуточные результаты до конца запроса', async () => {
    const progress = vi.fn(); await run('ok', { progress }); expect(progress.mock.calls.length).toBeGreaterThan(3);
  });
  it('события плеера объясняют ошибку и не принимают чужие ID', () => {
    const items = [{ id, name: 'Ролик' }];
    expect(playbackLine({ kind: 'error', id, code: 3 }, items)?.text).toContain('декодировать');
    expect(playbackLine({ kind: 'playing', id }, items)?.level).toBe('ok');
    expect(playbackLine({ kind: 'playing', id: 'чужое' }, items)).toBeNull();
  });
});
