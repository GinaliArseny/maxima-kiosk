import type { LocalConfig } from './config';
import { JellyfinClient, JellyfinError, type VideoItem } from './jellyfin';
import type { SettingsResult } from './remoteSettings';
export interface DiagnosticLine { level: 'ok' | 'warn' | 'error' | 'info'; text: string }
export interface SaverPlaylist { items: (VideoItem & { url: string })[]; muted: boolean; test?: boolean }
export interface Preparation { report: DiagnosticLine[]; playlist?: SaverPlaylist }
export async function prepareSaver(o: {
  loadSettings: () => Promise<SettingsResult>;
  jellyfin: LocalConfig['jellyfin'];
  fetch: typeof fetch;
  manual: boolean;
  progress?: (lines: DiagnosticLine[]) => void;
}): Promise<Preparation> {
  const report: DiagnosticLine[] = [];
  const add = (level: DiagnosticLine['level'], text: string) => { report.push({ level, text }); o.progress?.([...report]); };
  let stage = 'Загрузка настроек';
  try {
    add('info', 'Получаем настройки заставки…');
    const result = await o.loadSettings();
    if (result.note) add(result.settings ? 'warn' : 'error', result.note);
    if (!result.settings) return { report };
    const s = result.settings;
    add(result.source === 'cache' ? 'warn' : 'ok', result.source === 'cache' ? 'Используется последняя локальная копия настроек.' : 'Настройки получены с сервера.');
    add(s.enabled ? 'ok' : 'warn', s.enabled ? `Автозапуск: через ${s.idleMinutes} мин. простоя.` : 'Автозапуск выключен в веб-админке. Ручная проверка доступна.');
    if (!s.enabled && !o.manual) return { report };
    if (!s.sources.length) { add('error', 'Не выбрано ни одного видео или плейлиста. Добавьте ссылку и сохраните «Заставку» в веб-админке.'); return { report }; }
    if (!o.jellyfin) { add('error', 'Доступ к Jellyfin не настроен. Откройте «Заставка: Jellyfin», введите адрес, логин и пароль, затем сохраните.'); return { report }; }
    const jf = new JellyfinClient({ ...o.jellyfin, fetch: o.fetch });
    stage = 'Подключение к Jellyfin'; add('info', 'Проверяем внутренний и запасной адреса Jellyfin…');
    const base = await jf.resolveBase();
    add('ok', base === o.jellyfin.internalUrl.replace(/\/+$/, '') ? 'Jellyfin доступен по внутреннему адресу.' : 'Jellyfin доступен по внешнему запасному адресу.');
    stage = 'Вход в Jellyfin'; add('info', 'Проверяем логин и пароль…'); await jf.login(); add('ok', 'Вход в Jellyfin выполнен.');
    stage = 'Получение видео'; add('info', 'Получаем видео из выбранных источников…');
    const items = await jf.expand(s.sources.map(x => x.itemId));
    if (!items.length) { add('error', 'Видео не найдены. Проверьте содержимое библиотеки, ID и доступ пользователя Jellyfin к выбранным источникам.'); return { report }; }
    add('ok', `Найдено видео: ${items.length}.`);
    return { report, playlist: { items: items.map(i => ({ ...i, url: jf.streamUrl(i.id) })), muted: s.muted, test: o.manual } };
  } catch (err) {
    add('error', err instanceof JellyfinError ? err.message : `${stage}: запрос не завершён. Проверьте сеть и доступность сервера; повторите проверку.`);
    return { report };
  }
}
export type PlaybackEvent = { kind: 'playing' | 'error'; id: string; code?: number };
/** Текст сообщения формируется здесь: renderer не может передать URL с токеном в отчёт. */
export function playbackLine(event: PlaybackEvent, items: VideoItem[]): DiagnosticLine | null {
  const item = items.find(x => x.id === event.id);
  if (!item) return null;
  if (event.kind === 'playing') return { level: 'ok', text: `Воспроизведение началось: «${item.name}».` };
  if (event.kind !== 'error') return null;
  const reasons: Record<number, string> = { 0: 'не началось за 15 секунд', 1: 'воспроизведение прервано', 2: 'ошибка сети при загрузке видео', 3: 'не удалось декодировать видео', 4: 'источник недоступен или формат не поддерживается', 5: 'поток остановился более чем на 20 секунд', 6: 'проигрыватель отклонил запуск' };
  return { level: 'error', text: `«${item.name}»: ${reasons[event.code ?? 0] ?? 'ошибка воспроизведения'}.` };
}
