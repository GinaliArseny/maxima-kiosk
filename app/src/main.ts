import { app, BrowserWindow, dialog, globalShortcut, ipcMain, powerMonitor, type IpcMainInvokeEvent } from 'electron';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadConfig, localConfigSchema, saveConfig, type LocalConfig } from './config';
import { createCornerGesture } from './cornerGesture';
import { createEmergencyExit, EMERGENCY_ACCELERATOR } from './emergency';
import { createIdleWatcher } from './idleWatcher';
import { prepareSaver, playbackLine, type DiagnosticLine, type SaverPlaylist, type PlaybackEvent } from './saverDiagnostic';
import { createMainWindow, openKiosk } from './mainWindow';
import { GAME_LOGIN_URL, isAwayFromKiosk, isKioskHome } from './navigation';
import { DiagnosticLog } from './diagnosticLog';
import { diagnosticLogDir, configPath, screensaverCachePath, serviceExitFlag } from './paths';
import { hashPin, PinGuard, verifyPin } from './pin';
import { checkProtections, isKioskShell, winRegQuery, winTaskExists } from './protections';
import { loadScreensaverSettings, type Screensaver } from './remoteSettings';
import { createScreensaverWindow } from './screensaverWindow';
import { createServiceWindow } from './serviceWindow';
import { devSnapshot } from './devSnapshot';

// Киоск: свайп назад по истории, зум и автозапуск звука — под контролем программы.
app.commandLine.appendSwitch('overscroll-history-navigation', '0');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

/** Чужая страница (игра, форма её пароля) без касаний столько секунд — программа возвращает на главную. */
const AWAY_IDLE_SEC = 120;

/** Запуск внешней программы без системного окна ошибки у посетителей, если что-то пошло не так. */
function detached(cmd: string, args: string[]) {
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.on('error', (err) => console.warn(`не запустился ${cmd}:`, err.message));
  child.unref();
}
let allowQuit = false;

if (!app.requestSingleInstanceLock()) app.exit(0);

app.on('before-quit', () => (allowQuit = true));
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  /* киоск не закрывается сам */
});

void app.whenReady().then(() => {
  rmSync(serviceExitFlag(), { force: true });
  let cfg: LocalConfig = loadConfig(configPath());
  const log = new DiagnosticLog(diagnosticLogDir(), () => [cfg.jellyfin?.password ?? '', cfg.pinHash ?? '']);
  log.write('app.start', `Версия ${app.getVersion()}; ОС ${process.platform} ${process.arch}`);
  app.on('will-quit', () => log.write('app.quit'));
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
      if (manualTest) stopSaver();
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

  // Аварийный выход с клавиатуры: на обычном компьютере — сразу, на киоске — окно PIN.
  const emergency = createEmergencyExit({
    isKioskShell: async () => process.platform === 'win32' && isKioskShell(winRegQuery, app.getPath('exe')),
    quit: () => {
      log.write('app.emergency-exit');
      allowQuit = true;
      app.exit(0);
    },
    askPin: () => !guard.locked() && openService(),
  });
  if (!globalShortcut.register(EMERGENCY_ACCELERATOR, () => void emergency())) {
    console.warn(`аварийная комбинация ${EMERGENCY_ACCELERATOR} занята другой программой`);
  }

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

  let exporting = false;
  handle('service:export-log', true, async () => {
    if (exporting) return { ok: false, error: 'Сохранение уже открыто.' };
    exporting = true;
    const owner = service!;
    try {
      const result = await dialog.showSaveDialog(owner, {
        title: 'Сохранить отчёт о заставке',
        defaultPath: join(app.getPath('desktop'), `MaximaKiosk-report-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`),
        filters: [{ name: 'Текстовый отчёт', extensions: ['txt'] }],
      });
      if (result.canceled || !result.filePath || !alive(owner) || service !== owner || !authed) return { ok: false, canceled: true };
      if (!result.filePath.toLowerCase().endsWith('.txt')) return { ok: false, error: 'Выберите имя файла с расширением .txt.' };
      log.write('report.export');
      log.exportTo(result.filePath, app.getVersion());
      return { ok: true, path: result.filePath };
    } catch { return { ok: false, error: 'Не удалось сохранить отчёт. Выберите другую папку или проверьте свободное место.' }; }
    finally { exporting = false; }
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
    if (['relaunch', 'desktop', 'shutdown'].includes(name)) log.write('app.action', name);
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
  let saverItems: SaverPlaylist | null = null;
  let starting = false;
  let attemptNo = 0;
  let saverAttempt: string | undefined;
  const beginAttempt = (mode: 'manual' | 'auto') => {
    saverAttempt = `${mode}-${++attemptNo}`;
    log.write('saver.start', mode === 'manual' ? 'Ручная проверка' : 'Автоматический запуск', 'info', saverAttempt);
  };
  const logProgress = (lines: DiagnosticLine[]) => {
    const last = lines.at(-1);
    if (last) log.write('saver.prepare', last.text, last.level, saverAttempt);
  };
  let manualTest: { owner: BrowserWindow; report: DiagnosticLine[]; resolve: (r: DiagnosticLine[]) => void; abort: AbortController; timer?: ReturnType<typeof setTimeout> } | null = null;
  const settingsUrl = new URL('data/screensaver.json', cfg.kioskUrl).href;
  const refreshSettings = async (fetchImpl = fetch) => {
    const result = await loadScreensaverSettings(fetchImpl, settingsUrl, screensaverCachePath());
    settings = result.settings;
    return result;
  };
  void refreshSettings();
  const thresholdSec = () => Number(process.env.KIOSK_DEV_IDLE_SEC) || (settings?.idleMinutes ?? 3) * 60;

  function stopSaver(reason = 'Завершение показа или проверки') {
    if (manualTest || alive(saver)) log.write('saver.stop', reason, 'info', saverAttempt);
    const test = manualTest;
    manualTest = null;
    if (test) {
      test.abort.abort();
      clearTimeout(test.timer);
    }
    const window = saver;
    saver = null;
    if (alive(window)) window.close();
    if (test) {
      if (!test.report.some(x => x.level === 'error' || x.text.startsWith('Воспроизведение началось:'))) {
        test.report.push({ level: 'warn', text: 'Проверка завершена до подтверждения воспроизведения.' });
      }
      test.resolve(test.report);
      if (alive(test.owner)) { test.owner.show(); test.owner.focus(); }
    } else if (!main.isDestroyed()) main.focus();
  }
  function openSaver(playlist: SaverPlaylist) {
    saverItems = playlist;
    const window = createScreensaverWindow();
    saver = window;
    log.write('saver.window-open', '', 'info', saverAttempt);
    window.on('closed', () => {
      if (saver !== window) return;
      log.write('saver.window-closed', '', 'info', saverAttempt);
      saver = null;
      if (manualTest) stopSaver();
    });
    const failed = () => {
      if (saver !== window) return;
      log.write('saver.window-error', 'Окно проигрывателя не открылось или завершилось с ошибкой.', 'error', saverAttempt);
      manualTest?.report.push({ level: 'error', text: 'Окно проигрывателя не удалось открыть или оно завершилось с ошибкой.' });
      stopSaver();
    };
    window.webContents.on('render-process-gone', failed);
    window.webContents.on('did-fail-load', failed);
  }
  async function startSaver() {
    if (alive(saver) || starting || alive(service) || manualTest) return;
    starting = true;
    beginAttempt('auto');
    try {
      const devStreams = !app.isPackaged && process.env.KIOSK_DEV === '1' ? process.env.KIOSK_DEV_STREAMS : undefined;
      if (devStreams) {
        openSaver({ items: devStreams.split(',').map((url, i) => ({ id: String(i), name: 'Тестовое видео', url })), muted: true });
        return;
      }
      const result = await prepareSaver({ loadSettings: () => refreshSettings(), jellyfin: cfg.jellyfin, fetch, manual: false, progress: logProgress });
      // Не перекрывать обслуживание или посетителя, подошедшего во время сетевого запроса.
      if (!result.playlist) { log.write('saver.not-started', 'Подготовка не дала видео: причина в предыдущих событиях.', 'warn', saverAttempt); return; }
      if (alive(service) || powerMonitor.getSystemIdleTime() < thresholdSec()) {
        log.write('saver.cancelled', 'Во время подготовки появился посетитель или открыто обслуживание.', 'info', saverAttempt); return;
      }
      if (!isKioskHome(main.webContents.getURL(), cfg.kioskUrl)) void main.loadURL(cfg.kioskUrl);
      openSaver(result.playlist);
    } catch { log.write('saver.unexpected-error', 'Не удалось открыть заставку.', 'error', saverAttempt); }
    finally { starting = false; }
  }
  handle('service:test-screensaver', true, (): Promise<DiagnosticLine[]> => {
    if (starting || manualTest || alive(saver)) return Promise.resolve([{ level: 'warn', text: 'Заставка уже запускается. Повторите проверку через несколько секунд.' }]);
    const owner = service!;
    beginAttempt('manual');
    return new Promise((resolve) => {
      const test = { owner, report: [] as DiagnosticLine[], resolve, abort: new AbortController(), timer: undefined as ReturnType<typeof setTimeout> | undefined };
      manualTest = test;
      test.timer = setTimeout(() => {
        if (manualTest !== test) return;
        log.write('saver.timeout', 'Лимит ручной проверки: 2 минуты.', 'warn', saverAttempt);
        test.report.push({ level: 'warn', text: 'Проверка завершена по лимиту 2 минуты. При необходимости запустите её снова.' });
        stopSaver();
      }, 120_000);
      const testFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: AbortSignal.any([test.abort.signal, ...(init?.signal ? [init.signal] : [])]) });
      void prepareSaver({
        loadSettings: () => refreshSettings(testFetch), jellyfin: cfg.jellyfin, fetch: testFetch, manual: true,
        progress: lines => {
          if (manualTest !== test) return;
          logProgress(lines);
          test.report = lines;
          if (alive(owner)) owner.webContents.send('service:test-progress', lines);
        },
      }).then(result => {
        if (manualTest !== test) return;
        test.report = result.report;
        if (!result.playlist || !alive(owner) || !authed) return stopSaver();
        test.report.push({ level: 'info', text: 'Открываем видео. Коснитесь экрана для возврата к результатам проверки.' });
        owner.hide();
        openSaver(result.playlist);
      }).catch(() => {
        if (manualTest !== test) return;
        log.write('saver.unexpected-error', 'Не удалось запустить проверку.', 'error', saverAttempt);
        test.report.push({ level: 'error', text: 'Не удалось запустить проверку. Повторите попытку.' });
        stopSaver();
      });
    });
  });
  handle('service:cancel-test', true, () => { if (manualTest) stopSaver('Проверка отменена администратором'); });
  ipcMain.handle('screensaver:items', (e) => {
    if (!saver || e.sender !== saver.webContents) throw new Error('нет доступа');
    return saverItems;
  });
  ipcMain.on('screensaver:playback', (e, event: PlaybackEvent) => {
    if (!saver || e.sender !== saver.webContents || !saverItems || !event || typeof event.id !== 'string') return;
    const line = playbackLine(event, saverItems.items);
    // В файл — номер ролика, без его названия и URL. События автоматического показа тоже сохраняются.
    const safeLine = playbackLine(event, saverItems.items.map((item, i) => ({ ...item, name: `Видео ${i + 1}` })));
    if (safeLine) log.write(`saver.playback.${event.kind}`, safeLine.text, safeLine.level, saverAttempt);
    if (line && manualTest && manualTest.report.length < 60 && !manualTest.report.some(x => x.text === line.text)) manualTest.report.push(line);
  });
  ipcMain.on('screensaver:dismiss', (e) => {
    if (saver && e.sender === saver.webContents) stopSaver('Касание экрана, клавиша или исчерпаны доступные ролики');
  });
  // Разработка: KIOSK_DEV_STREAMS — заставка сразу при старте, без учёта простоя этого компьютера.
  if (!app.isPackaged && process.env.KIOSK_DEV === '1' && process.env.KIOSK_DEV_STREAMS) setTimeout(() => void startSaver(), 3000);
  else createIdleWatcher({
    getIdleSeconds: () => powerMonitor.getSystemIdleTime(),
    thresholdSec,
    pollMs: 5000,
    onIdle: () => void startSaver(),
    retryMs: 60_000,
    onActive: () => { if (!manualTest) stopSaver('Системный таймер обнаружил активность'); },
  });

  // Один снимок в минуту позволяет увидеть сбросы простоя, не раздувая журнал каждым опросом.
  const logIdle = () => log.write('idle.state', `Простой: ${powerMonitor.getSystemIdleTime()} с; порог: ${thresholdSec()} с; включено: ${settings?.enabled ?? 'нет настроек'}; обслуживание: ${alive(service)}; заставка: ${alive(saver)}; подготовка: ${starting}`);
  logIdle();
  const idleLogTimer = setInterval(logIdle, 60_000);
  app.on('will-quit', () => clearInterval(idleLogTimer));

  // Страховка от тупика: игра или форма её пароля без касаний — назад на стенд (у игры есть и свой возврат).
  createIdleWatcher({
    getIdleSeconds: () => powerMonitor.getSystemIdleTime(),
    thresholdSec: () => (process.env.KIOSK_DEV === '1' && Number(process.env.KIOSK_DEV_AWAY_SEC)) || AWAY_IDLE_SEC,
    pollMs: 5000,
    onIdle: () => {
      if (!main.isDestroyed() && !alive(service) && isAwayFromKiosk(main.webContents.getURL(), cfg.kioskUrl)) void main.loadURL(cfg.kioskUrl);
    },
    onActive: () => {},
  });

  if (process.env.KIOSK_DEV_SERVICE === '1') openService();
  devSnapshot(() => (alive(saver) ? saver : alive(service) ? service : main));
});
