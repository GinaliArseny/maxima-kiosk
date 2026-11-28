// Интеграционный тест установленного EXE на одноразовой Windows CI.
// Подменены только серверные ответы. Окна, preload, IPC и проигрыватель — настоящие.
const { _electron: electron } = require('playwright-core');
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
if (process.env.GITHUB_ACTIONS !== 'true' || process.platform !== 'win32') throw Error('Windows CI only');
const media = readFileSync(join(__dirname, '../tests/fixtures/saver.webm'));
let badVideo = false;
const server = createServer((req, res) => {
  if (badVideo) { res.writeHead(404); return res.end(); }
  // Chromium умеет воспроизводить короткую полную WebM-фикстуру без Range.
  res.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': media.length }); res.end(media);
});
(async () => {
  await new Promise(resolve => server.listen(18996, '127.0.0.1', resolve));
  const app = await electron.launch({ executablePath: 'C:\\Program Files\\MaximaKiosk\\MaximaKiosk.exe', timeout: 60000 });
  let service;
  try {
    const main = await app.firstWindow();
    // Локальная страница приложения: проверка не зависит от доступности сайта клиники.
    await app.evaluate(async ({ BrowserWindow, app, powerMonitor }) => {
      globalThis.__ciIdle = 0;
      powerMonitor.getSystemIdleTime = () => globalThis.__ciIdle;
      globalThis.__ciMode = 'password';
      globalThis.fetch = async (input) => {
        const u = new URL(String(input));
        if (u.pathname.endsWith('/screensaver.json')) {
          if (globalThis.__ciMode === 'settings404') return new Response('', { status: 404 });
          return Response.json({ enabled: globalThis.__ciMode === 'auto', idleMinutes: 1, muted: true, sources: [{ itemId: 'a'.repeat(32) }] });
        }
        if (u.pathname === '/System/Info/Public') return Response.json({});
        if (u.pathname === '/Users/AuthenticateByName') return globalThis.__ciMode === 'password' ? new Response('', { status: 401 }) : Response.json({ AccessToken: 'ci-token', User: { Id: 'ci' } });
        if (u.pathname === '/Items') return Response.json({ Items: globalThis.__ciMode === 'empty' ? [] : [{ Id: 'a'.repeat(32), Name: 'Проверочное видео', Type: 'Video' }] });
        return new Response('', { status: 404 });
      };
      await BrowserWindow.getAllWindows()[0].loadFile(app.getAppPath() + '/pages/offline.html');
    });
    const next = app.waitForEvent('window');
    for (let i = 0; i < 5; i++) await main.mouse.click(30, 30);
    service = await next;
    await service.getByRole('heading', { name: 'Введите PIN', exact: true }).waitFor();
    await assert.rejects(service.evaluate(() => window.kiosk.testScreensaver()), /нужен PIN/);
    await assert.rejects(service.evaluate(() => window.kiosk.exportLog()), /нужен PIN/);
    for (const digit of '2468') await service.getByRole('button', { name: digit, exact: true }).click();
    await service.getByRole('button', { name: 'OK', exact: true }).click();
    await service.getByRole('button', { name: 'Проверить заставку', exact: true }).waitFor();
    await service.screenshot({ path: 'shots/4-service-menu.png' });
    // PIN реально прочитан из старого файла после обновления, тест без ожидания запускается кнопкой.
    await service.getByRole('button', { name: 'Проверить заставку', exact: true }).click();
    await service.getByRole('heading', { name: 'Результат проверки заставки' }).waitFor();
    assert.match(await service.locator('body').innerText(), /неверный пользователь или пароль/);
    await service.screenshot({ path: 'shots/5-password-diagnostic.png' });

    await app.evaluate(() => { globalThis.__ciMode = 'empty'; });
    await service.getByRole('button', { name: 'Проверить ещё раз' }).click();
    await service.getByRole('heading', { name: 'Результат проверки заставки' }).waitFor();
    assert.match(await service.locator('body').innerText(), /Видео не найдены/);

    await app.evaluate(() => { globalThis.__ciMode = 'ok'; });
    const videoWindow = app.waitForEvent('window');
    await service.getByRole('button', { name: 'Проверить ещё раз' }).click();
    const video = await videoWindow;
    await video.locator('#testHint').waitFor();
    // Реальный декодер должен сдвинуть currentTime. Никаких поддельных playing-событий.
    await video.waitForFunction(() => document.querySelector('#fg').currentTime > 0.3, null, { timeout: 20000 });
    await video.screenshot({ path: 'shots/6-video-preview.png' });
    await video.mouse.click(200, 200);
    await service.getByRole('heading', { name: 'Результат проверки заставки' }).waitFor();
    assert.match(await service.locator('body').innerText(), /Воспроизведение началось/);
    assert.match(await service.locator('body').innerText(), /Автозапуск выключен/);
    await service.screenshot({ path: 'shots/7-playback-result.png' });

    badVideo = true;
    await service.getByRole('button', { name: 'Проверить ещё раз' }).click();
    await service.getByRole('heading', { name: 'Результат проверки заставки' }).waitFor({ timeout: 30000 });
    assert.match(await service.locator('body').innerText(), /источник недоступен|проигрыватель отклонил|ошибка сети/);
    const report = await service.locator('body').innerText();
    assert.doesNotMatch(report, /ci-token|ci-fake-password|ApiKey=/);
    await service.screenshot({ path: 'shots/8-media-error.png' });
    await service.getByRole('button', { name: 'Назад в меню' }).click();
    // Автоматический запуск: ждём только опроса (5 с), системный простой подменён.
    badVideo = false;
    const autoWindow = app.waitForEvent('window', { timeout: 20000 });
    await service.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await app.evaluate(() => { globalThis.__ciMode = 'auto'; globalThis.__ciIdle = 61; });
    const autoVideo = await autoWindow;
    await autoVideo.waitForFunction(() => document.querySelector('#fg').currentTime > 0.3, null, { timeout: 20000 });
    await autoVideo.mouse.click(200, 200);
    await app.evaluate(async ({ BrowserWindow, app }) => {
      globalThis.__ciIdle = 0;
      await BrowserWindow.getAllWindows()[0].loadFile(app.getAppPath() + '/pages/offline.html');
    });
    const serviceAgain = app.waitForEvent('window');
    for (let i = 0; i < 5; i++) await main.mouse.click(30, 30);
    service = await serviceAgain;
    await service.getByRole('heading', { name: 'Введите PIN', exact: true }).waitFor();
    for (const digit of '2468') await service.getByRole('button', { name: digit, exact: true }).click();
    await service.getByRole('button', { name: 'OK', exact: true }).click();
    // Подменяется только системный выбор пути. Кнопка, IPC и запись файла настоящие.
    const exported = await app.evaluate(({ dialog, app }) => {
      const filePath = app.getPath('temp') + '/MaximaKiosk-ci-report.txt';
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
      return filePath;
    });
    await service.getByRole('button', { name: 'Сохранить отчёт', exact: true }).click();
    await service.getByText('Отчёт сохранён:', { exact: false }).waitFor();
    const saved = readFileSync(exported, 'utf8');
    assert.match(saved, /manual-\d+/); assert.match(saved, /auto-\d+/);
    assert.match(saved, /saver.playback.playing/); assert.match(saved, /saver.playback.error/);
    assert.match(saved, /неверный пользователь или пароль/); assert.match(saved, /idle.state/);
    assert.doesNotMatch(saved, /ci-token|ci-fake-password|ApiKey=|http:\/\/127|Проверочное видео/);
    const rows = saved.split('\n').filter(x => x.startsWith('{')).map(x => JSON.parse(x));
    assert(rows.some(x => x.attempt?.startsWith('auto-') && x.event === 'saver.playback.playing'));
    await service.screenshot({ path: 'shots/9-export-report.png' });
    await service.getByRole('button', { name: 'Назад в меню' }).click();
    await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }); });
    await service.getByRole('button', { name: 'Сохранить отчёт', exact: true }).click();
    await service.getByText('Сохранение отменено.', { exact: true }).waitFor();
    await service.getByRole('button', { name: 'Назад в меню' }).click();
    const closed = app.waitForEvent('close', { timeout: 15000 });
    await service.getByRole('button', { name: 'Выйти на рабочий стол' }).click();
    await closed;
    console.log('✓ PIN сохранён; ручная диагностика ошибок, реальное видео, автоматический запуск, журнал и экспорт проверены');
  } catch (err) {
    if (service && !service.isClosed()) await service.screenshot({ path: 'shots/diagnostic-failure.png' }).catch(() => {});
    throw err;
  } finally { await app.close().catch(() => {}); server.close(); }
})().catch(err => { console.error(err); server.close(); process.exitCode = 1; });
