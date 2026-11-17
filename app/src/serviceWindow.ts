import { BrowserWindow } from 'electron';
import { join } from 'node:path';

/** Сервисное окно поверх киоска: PIN-пад и меню. Локальная страница, без доступа к Node. */
export function createServiceWindow(parent: BrowserWindow): BrowserWindow {
  const dev = process.env.KIOSK_DEV === '1';
  const win = new BrowserWindow({
    parent,
    fullscreen: !dev,
    width: 1920,
    height: 1080,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload-service.js'),
      contextIsolation: true,
      sandbox: true,
      devTools: false,
    },
  });
  if (!dev) win.setAlwaysOnTop(true, 'screen-saver', 2);
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });
  void win.loadFile(join(__dirname, '..', 'pages', 'service.html'));
  return win;
}
