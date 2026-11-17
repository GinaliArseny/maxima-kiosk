import { app, type BrowserWindow } from 'electron';
import { writeFileSync } from 'node:fs';

/**
 * Только для проверки на компьютере разработчика: KIOSK_SNAPSHOT=<путь.png> — через delay мс
 * снять картинку окна и выйти. В киоске переменная не задана — ничего не делает.
 */
export function devSnapshot(getWin: () => BrowserWindow | null, delay = 4000): void {
  const out = process.env.KIOSK_SNAPSHOT;
  if (!out || process.env.KIOSK_DEV !== '1') return;
  setTimeout(async () => {
    const win = getWin();
    if (win && !win.isDestroyed()) writeFileSync(out, (await win.webContents.capturePage()).toPNG());
    app.exit(0);
  }, Number(process.env.KIOSK_SNAPSHOT_DELAY ?? delay));
}
