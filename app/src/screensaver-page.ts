/** Плеер заставки: ролики по кругу; вертикальные — по центру с размытым фоном из того же кадра. */
import { createPlaylistCursor, type VideoItem } from './jellyfin';
import type { PlaybackEvent } from './saverDiagnostic';
import { createStallWatch } from './stallWatch';

interface SaverApi {
  items: () => Promise<{ items: (VideoItem & { url: string })[]; muted: boolean; test?: boolean }>;
  dismiss: () => void;
  playback: (event: PlaybackEvent) => void;
}
const saver = (window as unknown as { saver: SaverApi }).saver;
const fg = document.getElementById('fg') as HTMLVideoElement;
const bg = document.getElementById('bg') as HTMLVideoElement;
const START_TIMEOUT_MS = 15_000;

// Перед закрытием фиксируем прогресс: timeupdate может ещё не успеть прийти.
let reportProgress = () => {};
const dismiss = () => { reportProgress(); saver.dismiss(); };
window.addEventListener('pointerdown', dismiss, { capture: true });
window.addEventListener('keydown', dismiss, { capture: true });

async function start() {
  const { items, muted, test } = await saver.items();
  if (test) {
    const hint = document.createElement('div');
    hint.id = 'testHint';
    hint.textContent = 'Проверка заставки · коснитесь экрана для возврата к результатам';
    document.body.append(hint);
  }
  const urls = new Map(items.map((i) => [i.id, i.url]));
  const queue = createPlaylistCursor(items);
  let current: VideoItem | null = null;
  let reported = false;
  let failing = false;
  let guard: ReturnType<typeof setTimeout> | undefined;
  let stall: { stop(): void } | undefined;

  const playNext = () => {
    clearTimeout(guard);
    stall?.stop();
    current = queue.next();
    reported = false;
    failing = false;
    if (!current) return saver.dismiss();
    const url = urls.get(current.id)!;
    bg.removeAttribute('src');
    bg.hidden = true;
    fg.muted = muted;
    fg.src = url;
    const playingId = current.id;
    void fg.play().catch((err: Error) => { if (current?.id === playingId && err.name !== 'AbortError') broken(6); });
    // Не стартовал за 15 с — считаем сломанным и идём дальше.
    guard = setTimeout(() => broken(0), START_TIMEOUT_MS);
  };
  const broken = (code = 0) => {
    if (!current || failing) return;
    failing = true;
    clearTimeout(guard); stall?.stop();
    saver.playback({ kind: 'error', id: current.id, code });
    queue.markBroken(current.id);
    setTimeout(playNext, 0);
  };
  reportProgress = () => {
    if (current && !reported && fg.currentTime > 0.25) {
      reported = true;
      saver.playback({ kind: 'playing', id: current.id });
    }
  };
  fg.addEventListener('timeupdate', reportProgress);

  fg.addEventListener('playing', () => {
    clearTimeout(guard);
    // Посреди ролика поток может замолчать без error — 20 с без движения = сломан.
    stall?.stop();
    stall = createStallWatch({ currentTime: () => fg.currentTime, onStall: () => broken(5), checkMs: 5000, stallMs: 20_000 });
  });
  fg.addEventListener('ended', playNext);
  fg.addEventListener('error', () => {
    console.warn('ролик не открылся:', current?.name, fg.error?.code);
    broken(fg.error?.code ?? 4);
  });
  fg.addEventListener('loadedmetadata', () => {
    // Кадр уже экрана (вертикальное видео) — включаем размытый фон из того же ролика.
    const narrow = fg.videoWidth / fg.videoHeight < window.innerWidth / window.innerHeight - 0.05;
    if (!narrow || !current) return;
    bg.src = urls.get(current.id)!;
    bg.hidden = false;
    void bg.play().catch(() => {});
  });
  // Фон идёт синхронно с основным кадром.
  setInterval(() => {
    if (!bg.hidden && Math.abs(bg.currentTime - fg.currentTime) > 0.5) bg.currentTime = fg.currentTime;
  }, 3000);

  playNext();
}
void start();
