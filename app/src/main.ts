import { app, BrowserWindow, ipcMain, powerMonitor, type IpcMainInvokeEvent } from 'electron';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadConfig, localConfigSchema, saveConfig, type LocalConfig } from './config';
import { createCornerGesture } from './cornerGesture';
import { createIdleWatcher } from './idleWatcher';
import { JellyfinClient, type VideoItem } from './jellyfin';
import { createMainWindow, openKiosk } from './mainWindow';
import { isKioskHome } from './navigation';
import { configPath, screensaverCachePath, serviceExitFlag } from './paths';
import { hashPin, PinGuard, verifyPin } from './pin';
import { checkProtections, winRegQuery, winTaskExists } from './protections';
import { fetchScreensaverSettings, type Screensaver } from './remoteSettings';
import { createScreensaverWindow } from './screensaverWindow';
import { createServiceWindow } from './serviceWindow';
import { devSnapshot } from './devSnapshot';

// Киоск: свайп назад по истории, зум и автозапуск звука — под контролем программы.
app.commandLine.appendSwitch('overscroll-history-navigation', '0');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const GAME_LOGIN_URL = 'https://emailer.339933.net/game/';

/** Запуск внешней программы без системного окна ошибки у посетителей, если что-то пошло не так. */
function detached(cmd: string, args: string[]) {
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.on('error', (err) => console.warn(`не запустился ${cmd}:`, err.message));
  child.unref();
}
let allowQuit = false;

if (!app.requestSingleInstanceLock()) app.exit(0);

app.on('before-quit', () => (allowQuit = true));
app.on('window-all-closed', () => {
  /* киоск не закрывается сам */
});

void app.whenReady().then(() => {
  rmSync(serviceExitFlag(), { force: true });
  let cfg: LocalConfig = loadConfig(configPath());
  const guard = new PinGuard();
  let service: BrowserWindow | null = null;
  let saver: BrowserWindow | null = null;
  let authed = false;
  const alive = (w: BrowserWindow | null): w is BrowserWindow => Boolean(w && !w.isDestroyed());

  const main = createMainWindow({
    kioskUrl: cfg.kioskUrl,
    canClose: () => allowQuit,
    overlayOpen: () => alive(service) || alive(saver),
  });
  void openKiosk(main, cfg.kioskUrl);

  const closeService = () => {
    authed = false;
    if (service && !service.isDestroyed()) service.close();
    service = null;
    if (!main.isDestroyed()) main.focus();
  };
  const openService = () => {
    if (service && !service.isDestroyed()) return;
    stopSaver();
    service = createServiceWindow(main);
    service.on('closed', () => {
      service = null;
      authed = false;
    });
  };

  const gesture = createCornerGesture({
    taps: 5,
    windowMs: 3000,
    zone: 100,
    now: Date.now,
    onTrigger: () => !guard.locked() && openService(),
  });
  ipcMain.on('corner-tap', (e, p: { x: number; y: number }) => {
    if (e.sender === main.webContents) gesture(p.x, p.y);
  });

  const save = (next: LocalConfig) => {
    cfg = next;
    saveConfig(configPath(), cfg);
  };
  /** Обработчик сервисного окна; требовать вход по PIN — authRequired. */
  const handle = <A extends unknown[], R>(channel: string, authRequired: boolean, fn: (...args: A) => R) =>
    ipcMain.handle(channel, (e: IpcMainInvokeEvent, ...args: unknown[]) => {
      if (!service || e.sender !== service.webContents) throw new Error('нет доступа');
      if (authRequired && !authed) throw new Error('нужен PIN');
      return fn(...(args as A));
    });

  handle('service:state', false, () => ({ hasPin: Boolean(cfg.pinHash), locked: guard.locked() }));
  handle('service:pin', false, (pin: string) => {
    const ok = Boolean(cfg.pinHash) && verifyPin(String(pin), cfg.pinHash!);
    guard.attempt(ok);
    authed = ok;
    return { ok, locked: guard.locked() };
  });
  handle('service:set-pin', false, (pin: string) => {
    // Первый запуск (PIN ещё нет) — задать можно; дальше — только после входа.
    if (cfg.pinHash && !authed) return { ok: false, error: 'Сначала введите текущий PIN' };
    try {
      save({ ...cfg, pinHash: hashPin(String(pin)) });
      authed = true;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });
  handle('service:jellyfin', true, () => {
    const { internalUrl, externalUrl, user } = cfg.jellyfin ?? {};
    return { internalUrl, externalUrl, user };
  });
  handle('service:save-jellyfin', true, (raw: { password?: string } & Record<string, unknown>) => {
    const input = { ...raw, password: raw.password || cfg.jellyfin?.password || '' };
    const parsed = localConfigSchema.shape.jellyfin.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Проверьте адреса (нужно http://… или https://…) и пользователя' };
    save({ ...cfg, jellyfin: parsed.data });
    return { ok: true };
  });
  handle('service:protections', true, () =>
    process.platform === 'win32'
      ? checkProtections(winRegQuery, { exePath: app.getPath('exe'), taskExists: winTaskExists })
      : [{ name: 'Проверка доступна только на Windows', ok: false }],
  );
  handle('service:action', true, (name: string) => {
    if (name === 'relaunch') {
      allowQuit = true;
      app.relaunch();
      app.exit(0);
    } else if (name === 'game-login') {
      closeService();
      void main.loadURL(GAME_LOGIN_URL);
    } else if (name === 'desktop') {
      // Флаг — сторож не перезапускает киоск, пока владелец работает на рабочем столе.
      mkdirSync(dirname(serviceExitFlag()), { recursive: true });
      writeFileSync(serviceExitFlag(), new Date().toISOString());
      if (process.platform === 'win32') detached('explorer.exe', []);
      allowQuit = true;
      app.exit(0);
    } else if (name === 'shutdown') {
      // Окно киоска не должно мешать завершению работы Windows.
      allowQuit = true;
      if (process.platform === 'win32') detached('shutdown', ['/s', '/t', '0']);
    }
  });
  ipcMain.on('service:close', (e) => {
    if (service && e.sender === service.webContents) closeService();
  });

  // ── Заставка ─────────────────────────────────────────────────────────────
  let settings: Screensaver | null = null;
  let saverItems: { items: (VideoItem & { url: string })[]; muted: boolean } | null = null;
  let starting = false;
  const settingsUrl = new URL('data/screensaver.json', cfg.kioskUrl).href;
  const refreshSettings = async () => (settings = await fetchScreensaverSettings(fetch, settingsUrl, screensaverCachePath()));
  void refreshSettings();
  const thresholdSec = () => Number(process.env.KIOSK_DEV_IDLE_SEC) || (settings?.idleMinutes ?? 3) * 60;

  function stopSaver() {
    if (alive(saver)) saver.close();
    saver = null;
    if (!main.isDestroyed()) main.focus();
  }
  async function startSaver() {
    if (alive(saver) || starting || alive(service)) return;
    starting = true;
    try {
      // Только разработка: KIOSK_DEV_STREAMS=url1,url2 — ролики напрямую, без Jellyfin и настроек.
      const devStreams = process.env.KIOSK_DEV === '1' ? process.env.KIOSK_DEV_STREAMS : undefined;
      if (devStreams) {
        saverItems = { items: devStreams.split(',').map((url, i) => ({ id: String(i), name: url, url })), muted: true };
        saver = createScreensaverWindow();
        saver.on('closed', () => (saver = null));
        return;
      }
      const s = await refreshSettings();
      if (!s?.enabled || !s.sources.length || !cfg.jellyfin) return;
      const jf = new JellyfinClient({ ...cfg.jellyfin, fetch });
      await jf.resolveBase();
      await jf.login();
      const items = await jf.expand(s.sources.map((x) => x.itemId));
      // Пока ходили в Jellyfin, к киоску могли подойти.
      if (!items.length || powerMonitor.getSystemIdleTime() < thresholdSec()) return;
      saverItems = { items: items.map((i) => ({ ...i, url: jf.streamUrl(i.id) })), muted: s.muted };
      // Под заставкой — главная стенда, а не брошенная игра или раздел.
      if (!isKioskHome(main.webContents.getURL(), cfg.kioskUrl)) void main.loadURL(cfg.kioskUrl);
      saver = createScreensaverWindow();
      saver.on('closed', () => (saver = null));
    } catch (err) {
      console.warn('заставка не включилась:', (err as Error).message);
    } finally {
      starting = false;
    }
  }
  ipcMain.handle('screensaver:items', (e) => {
    if (!saver || e.sender !== saver.webContents) throw new Error('нет доступа');
    return saverItems;
  });
  ipcMain.on('screensaver:dismiss', (e) => {
    if (saver && e.sender === saver.webContents) stopSaver();
  });
  // Разработка: KIOSK_DEV_STREAMS — заставка сразу при старте, без учёта простоя этого компьютера.
  if (process.env.KIOSK_DEV === '1' && process.env.KIOSK_DEV_STREAMS) setTimeout(() => void startSaver(), 3000);
  else createIdleWatcher({
    getIdleSeconds: () => powerMonitor.getSystemIdleTime(),
    thresholdSec,
    pollMs: 5000,
    onIdle: () => void startSaver(),
    onActive: stopSaver,
  });

  if (process.env.KIOSK_DEV_SERVICE === '1') openService();
  devSnapshot(() => (alive(saver) ? saver : alive(service) ? service : main));
});
