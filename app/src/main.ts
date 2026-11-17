import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadConfig, localConfigSchema, saveConfig, type LocalConfig } from './config';
import { createCornerGesture } from './cornerGesture';
import { createMainWindow, openKiosk } from './mainWindow';
import { configPath, serviceExitFlag } from './paths';
import { hashPin, PinGuard, verifyPin } from './pin';
import { createServiceWindow } from './serviceWindow';
import { devSnapshot } from './devSnapshot';

// Киоск: свайп назад по истории, зум и автозапуск звука — под контролем программы.
app.commandLine.appendSwitch('overscroll-history-navigation', '0');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const GAME_LOGIN_URL = 'https://emailer.339933.net/game/';
let allowQuit = false;

if (!app.requestSingleInstanceLock()) app.exit(0);

app.on('window-all-closed', () => {
  /* киоск не закрывается сам */
});

void app.whenReady().then(() => {
  rmSync(serviceExitFlag(), { force: true });
  let cfg: LocalConfig = loadConfig(configPath());
  const guard = new PinGuard();
  let service: BrowserWindow | null = null;
  let authed = false;

  const main = createMainWindow({
    kioskUrl: cfg.kioskUrl,
    canClose: () => allowQuit,
    overlayOpen: () => Boolean(service && !service.isDestroyed()),
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
  handle('service:protections', true, async () => [] as { name: string; ok: boolean }[]);
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
      if (process.platform === 'win32') spawn('explorer.exe', [], { detached: true, stdio: 'ignore' }).unref();
      allowQuit = true;
      app.exit(0);
    } else if (name === 'shutdown') {
      if (process.platform === 'win32') spawn('shutdown', ['/s', '/t', '0'], { detached: true, stdio: 'ignore' }).unref();
    }
  });
  ipcMain.on('service:close', (e) => {
    if (service && e.sender === service.webContents) closeService();
  });

  if (process.env.KIOSK_DEV_SERVICE === '1') openService();
  devSnapshot(() => service ?? main);
});
