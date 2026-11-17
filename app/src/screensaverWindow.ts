import { BrowserWindow } from 'electron';
import { join } from 'node:path';

/** Окно заставки поверх сайта: перехватывает касание целиком, до сайта оно не доходит. */
export function createScreensaverWindow(): BrowserWindow {
  const dev = process.env.KIOSK_DEV === '1';
  const win = new BrowserWindow({
    fullscreen: !dev,
    width: 1920,
    height: 1080,
    frame: false,
    backgroundColor: '#000000',
    show: false,
    focusable: true,
    webPreferences: {
      preload: join(__dirname, 'preload-screensaver.js'),
      contextIsolation: true,
      sandbox: true,
      devTools: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  if (!dev) win.setAlwaysOnTop(true, 'screen-saver', 3);
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  if (dev) win.webContents.on('console-message', (e) => console.log('[заставка]', e.message));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });
  void win.loadFile(join(__dirname, '..', 'pages', 'screensaver.html'));
  return win;
}
