import { BrowserWindow, powerSaveBlocker, type Input } from 'electron';
import { join } from 'node:path';
import { isAllowedUrl } from './navigation';
import { loadWithRetry } from './startup';

/** Сочетания, которые в киоске ничего не должны делать (на случай клавиатуры). */
function isBlockedShortcut(i: Input): boolean {
  const key = i.key.toLowerCase();
  if (['f4'].includes(key) && i.alt) return true;
  if (['f5', 'f11', 'f12'].includes(key)) return true;
  const mod = i.control || i.meta;
  if (mod && ['w', 'r', 'q', 'n', 't', 'p', 'o', 's', '+', '-', '=', '0', 'l'].includes(key)) return true;
  if (mod && i.shift && ['i', 'j', 'c'].includes(key)) return true;
  return false;
}

export interface MainWindowDeps {
  kioskUrl: string;
  /** Можно ли закрыть окно (только после выхода по PIN). */
  canClose: () => boolean;
  /** Окна поверх (PIN, заставка) открыты — фокус не перехватываем. */
  overlayOpen: () => boolean;
}

/** Основное окно: сайт стенда на весь экран, уйти никуда нельзя. */
export function createMainWindow(deps: MainWindowDeps): BrowserWindow {
  // KIOSK_DEV=1 — обычное окно 1920×1080 для проверки на компьютере разработчика.
  const dev = process.env.KIOSK_DEV === '1';
  const win = new BrowserWindow({
    kiosk: !dev,
    fullscreen: !dev,
    width: 1920,
    height: 1080,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      partition: 'persist:kiosk',
      preload: join(__dirname, 'preload-site.js'),
      contextIsolation: true,
      sandbox: true,
      devTools: false,
      spellcheck: false,
    },
  });
  if (!dev) win.setAlwaysOnTop(true, 'screen-saver');
  win.setMenu(null);
  powerSaveBlocker.start('prevent-display-sleep');

  const wc = win.webContents;
  // Скачивание открыло бы системный диалог «Сохранить как» — через него можно уйти из киоска.
  wc.session.on('will-download', (e) => e.preventDefault());
  // Сайту и игре не нужны камера, микрофон, уведомления и т. п.
  wc.session.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  wc.session.setPermissionCheckHandler(() => false);
  // Зум страницы двумя пальцами запрещён (у каждой новой страницы заново).
  wc.on('did-finish-load', () => void wc.setVisualZoomLevelLimits(1, 1).catch(() => {}));
  wc.on('will-navigate', (e, url) => !isAllowedUrl(url) && e.preventDefault());
  wc.on('will-redirect', (e, url) => !isAllowedUrl(url) && e.preventDefault());
  wc.on('will-frame-navigate', (e) => !e.isMainFrame && !isAllowedUrl(e.url) && e.preventDefault());
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('before-input-event', (e, input) => isBlockedShortcut(input) && e.preventDefault());
  wc.on('context-menu', (e) => e.preventDefault());
  wc.on('will-attach-webview', (e) => e.preventDefault());
  wc.on('render-process-gone', () => setTimeout(() => !win.isDestroyed() && wc.reload(), 1000));
  wc.on('unresponsive', () => !win.isDestroyed() && wc.reload());
  wc.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    // -3 — переход отменён (в т.ч. нами), это не сбой сети.
    if (isMainFrame && code !== -3 && !url.startsWith('file:')) void openKiosk(win, deps.kioskUrl);
  });

  win.on('close', (e) => !dev && !deps.canClose() && e.preventDefault());
  win.on('blur', () =>
    !dev &&
    setTimeout(() => {
      if (win.isDestroyed() || deps.overlayOpen()) return;
      win.moveTop();
      win.focus();
    }, 500),
  );
  win.once('ready-to-show', () => win.show());
  return win;
}

const offlinePage = () => join(__dirname, '..', 'pages', 'offline.html');
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let opening = false;

/** Открыть сайт; без сети — своя страница ожидания и повтор каждые 15 с. */
export async function openKiosk(win: BrowserWindow, url: string): Promise<void> {
  if (opening) return;
  opening = true;
  try {
    await loadWithRetry(
      () => win.loadURL(url),
      () => void win.loadFile(offlinePage()).catch(() => {}),
      sleep,
    );
  } finally {
    opening = false;
  }
}
