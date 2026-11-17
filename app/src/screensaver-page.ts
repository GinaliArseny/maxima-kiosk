/** Плеер заставки: ролики по кругу; вертикальные — по центру с размытым фоном из того же кадра. */
import { createPlaylistCursor, type VideoItem } from './jellyfin';
import { createStallWatch } from './stallWatch';

interface SaverApi {
  items: () => Promise<{ items: (VideoItem & { url: string })[]; muted: boolean }>;
  dismiss: () => void;
}
const saver = (window as unknown as { saver: SaverApi }).saver;
const fg = document.getElementById('fg') as HTMLVideoElement;
const bg = document.getElementById('bg') as HTMLVideoElement;
const START_TIMEOUT_MS = 15_000;

// Любое касание — закрыть заставку; само касание дальше не идёт (окно заставки поверх всего).
window.addEventListener('pointerdown', () => saver.dismiss(), { capture: true });
window.addEventListener('keydown', () => saver.dismiss(), { capture: true });

async function start() {
  const { items, muted } = await saver.items();
  const urls = new Map(items.map((i) => [i.id, i.url]));
  const queue = createPlaylistCursor(items);
  let current: VideoItem | null = null;
  let guard: ReturnType<typeof setTimeout> | undefined;
  let stall: { stop(): void } | undefined;

  const playNext = () => {
    clearTimeout(guard);
    stall?.stop();
    current = queue.next();
    if (!current) return saver.dismiss();
    const url = urls.get(current.id)!;
    bg.removeAttribute('src');
    bg.hidden = true;
    fg.muted = muted;
    fg.src = url;
    void fg.play().catch(() => {});
    // Не стартовал за 15 с — считаем сломанным и идём дальше.
    guard = setTimeout(() => broken(), START_TIMEOUT_MS);
  };
  const broken = () => {
    if (current) queue.markBroken(current.id);
    playNext();
  };

  fg.addEventListener('playing', () => {
    clearTimeout(guard);
    // Посреди ролика поток может замолчать без error — 20 с без движения = сломан.
    stall?.stop();
    stall = createStallWatch({ currentTime: () => fg.currentTime, onStall: broken, checkMs: 5000, stallMs: 20_000 });
  });
  fg.addEventListener('ended', playNext);
  fg.addEventListener('error', () => {
    console.warn('ролик не открылся:', current?.name, fg.error?.code);
    broken();
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
