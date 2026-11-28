import type { DiagnosticLine } from './saverDiagnostic';
/** Сервисное окно: PIN-пад и меню обслуживания. Чистый DOM, без фреймворков. */
interface KioskApi {
  state: () => Promise<{ hasPin: boolean; locked: boolean }>;
  submitPin: (pin: string) => Promise<{ ok: boolean; locked: boolean }>;
  setPin: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  action: (name: 'relaunch' | 'game-login' | 'desktop' | 'shutdown') => Promise<void>;
  protections: () => Promise<{ name: string; ok: boolean }[]>;
  jellyfin: () => Promise<{ internalUrl?: string; externalUrl?: string; user?: string }>;
  saveJellyfin: (cfg: unknown) => Promise<{ ok: boolean; error?: string }>;
  testScreensaver: () => Promise<DiagnosticLine[]>;
  exportLog: () => Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }>;
  cancelTest: () => Promise<void>;
  onTestProgress: (cb: (lines: DiagnosticLine[]) => void) => () => void;
  close: () => void;
}
const kiosk = (window as unknown as { kiosk: KioskApi }).kiosk;
const root = document.getElementById('root')!;

// Сервисное окно не должно висеть открытым: минута без касаний — закрыть.
let checkingSaver = false;
let idle: ReturnType<typeof setTimeout>;
const arm = () => {
  clearTimeout(idle);
  if (checkingSaver) return;
  idle = setTimeout(() => kiosk.close(), 60_000);
};
window.addEventListener('pointerdown', arm, { capture: true });
window.addEventListener('keydown', arm, { capture: true });
arm();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
}
const button = (text: string, onclick: () => void, cls = '') => el('button', { textContent: text, onclick, className: cls, type: 'button' });
const show = (...kids: Node[]) => root.replaceChildren(...kids);

/** PIN-пад: цифры кнопками, своя «клавиатура» — системная экранная не нужна. */
function pinPad(title: string, onDone: (pin: string) => void, note = '') {
  let pin = '';
  const dots = el('div', { className: 'dots' });
  const msg = el('p', { className: 'note', textContent: note });
  const redraw = () => (dots.textContent = pin.length ? '●'.repeat(pin.length) : '—');
  redraw();
  const keys = el('div', { className: 'pad' });
  for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    keys.append(button(d, () => pin.length < 8 && ((pin += d), redraw())));
  keys.append(
    button('Стереть', () => ((pin = pin.slice(0, -1)), redraw()), 'muted'),
    button('0', () => pin.length < 8 && ((pin += '0'), redraw())),
    button('OK', () => pin.length >= 4 && onDone(pin), 'primary'),
  );
  show(el('h1', { textContent: title }), dots, msg, keys, button('Отмена', () => kiosk.close(), 'muted wide'));
  return { error: (text: string) => ((msg.textContent = text), (pin = ''), redraw()) };
}

function setPinFlow(then: () => void) {
  pinPad('Задайте PIN (4–8 цифр)', (first) => {
    const pad = pinPad('Повторите PIN', async (second) => {
      if (first !== second) return setPinFlow(then);
      const res = await kiosk.setPin(second);
      if (res.ok) then();
      else pad.error(res.error ?? 'Не удалось сохранить PIN');
    });
  });
}

async function protections() {
  const list = await kiosk.protections();
  show(
    el('h1', { textContent: 'Состояние защиты' }),
    el('ul', { className: 'checks' }, ...list.map((p) => el('li', { className: p.ok ? 'ok' : 'bad', textContent: `${p.ok ? '✓' : '✗'} ${p.name}` }))),
    el('p', {
      className: 'note',
      textContent: list.every((p) => p.ok)
        ? 'Всё на месте.'
        : 'Что-то сброшено (например, крупным обновлением Windows). Запустите install-kiosk.ps1 ещё раз от администратора.',
    }),
    button('Назад', menu, 'muted wide'),
  );
}

async function jellyfinForm() {
  const cur = await kiosk.jellyfin();
  const field = (label: string, name: string, value = '', type = 'text') => {
    const input = document.createElement('input');
    Object.assign(input, { name, value, type });
    input.setAttribute('autocomplete', 'off');
    return el('label', { className: 'field' }, label, input);
  };
  const msg = el('p', { className: 'note' });
  const form = document.createElement('form');
  form.append(
    field('Адрес Jellyfin в сети', 'internalUrl', cur.internalUrl ?? 'http://192.168.100.100:8096'),
    field('Внешний адрес (запасной)', 'externalUrl', cur.externalUrl ?? ''),
    field('Пользователь Jellyfin', 'user', cur.user ?? 'kiosk'),
    field('Пароль', 'password', '', 'password'),
    el('button', { type: 'submit', className: 'primary wide', textContent: 'Сохранить' }),
  );
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const res = await kiosk.saveJellyfin({
      internalUrl: data.internalUrl,
      externalUrl: data.externalUrl || undefined,
      user: data.user,
      password: data.password,
    });
    msg.textContent = res.ok ? 'Сохранено' : (res.error ?? 'Ошибка');
  };
  show(el('h1', { textContent: 'Заставка: доступ к Jellyfin' }), el('p', { className: 'note', textContent: 'Нужна клавиатура (USB или удалённый доступ). Пароль не показывается и хранится только на этом компьютере.' }), form, msg, button('Назад', menu, 'muted wide'));
}

async function testScreensaver() {
  checkingSaver = true;
  clearTimeout(idle);
  const list = el('ul', { className: 'checks' });
  const draw = (lines: DiagnosticLine[]) => list.replaceChildren(...lines.map(line => el('li', {
    className: line.level === 'error' ? 'bad' : line.level === 'ok' ? 'ok' : '',
    textContent: `${line.level === 'error' ? '✗' : line.level === 'ok' ? '✓' : '•'} ${line.text}`,
  })));
  const unsubscribe = kiosk.onTestProgress(draw);
  show(el('h1', { textContent: 'Проверка заставки' }), el('p', { className: 'note', textContent: 'Проверяем настройки и запускаем видео без ожидания. Касание видео вернёт к этому отчёту.' }), list,
    button('Отменить проверку', () => void kiosk.cancelTest(), 'muted wide'));
  let result: DiagnosticLine[];
  try { result = await kiosk.testScreensaver(); }
  catch { result = [{ level: 'error', text: 'Проверка не завершилась. Закройте меню и повторите попытку.' }]; }
  finally { unsubscribe(); checkingSaver = false; arm(); }
  draw(result.filter(line => line.level !== 'info'));
  const summary = result.find(line => line.level === 'error') ?? result.find(line => line.text.startsWith('Воспроизведение началось:')) ?? result.filter(line => line.level === 'warn').at(-1);
  show(el('h1', { textContent: 'Результат проверки заставки' }),
    el('p', { className: summary?.level === 'error' ? 'note bad' : 'note', textContent: summary?.text ?? 'Проверка завершена.' }), list,
    button('Проверить ещё раз', () => void testScreensaver(), 'primary wide'),
    button('Сохранить отчёт', () => void exportLog(), 'wide'),
    button('Настроить Jellyfin', () => void jellyfinForm(), 'wide'), button('Назад в меню', menu, 'muted wide'));
}

async function exportLog() {
  checkingSaver = true;
  clearTimeout(idle);
  const message = el('p', { className: 'note', textContent: 'Выберите, куда сохранить отчёт…' });
  show(el('h1', { textContent: 'Отчёт о заставке' }), message);
  try {
    const result = await kiosk.exportLog();
    message.textContent = result.ok ? `Отчёт сохранён: ${result.path}. Пришлите этот TXT-файл для разбора.`
      : result.canceled ? 'Сохранение отменено.' : result.error ?? 'Не удалось сохранить отчёт.';
  } catch { message.textContent = 'Не удалось сохранить отчёт. Повторите попытку.'; }
  finally { checkingSaver = false; arm(); }
  root.append(button('Сохранить ещё раз', () => void exportLog(), 'wide'), button('Назад в меню', menu, 'muted wide'));
}

function menu() {
  show(
    el('h1', { textContent: 'Обслуживание киоска' }),
    el(
      'div',
      { className: 'menu' },
      button('Перезапустить киоск', () => void kiosk.action('relaunch')),
      button('Войти в игру заново', () => void kiosk.action('game-login')),
      button('Сменить PIN', () => setPinFlow(menu)),
      button('Заставка: Jellyfin', () => void jellyfinForm()),
      button('Проверить заставку', () => void testScreensaver(), 'primary'),
      button('Сохранить отчёт', () => void exportLog()),
      button('Состояние защиты', () => void protections()),
      button('Выйти на рабочий стол', () => void kiosk.action('desktop'), 'danger'),
      button('Выключить компьютер', () => void kiosk.action('shutdown'), 'danger'),
      button('Закрыть', () => kiosk.close(), 'muted'),
    ),
  );
}

async function start() {
  const st = await kiosk.state();
  if (st.locked) {
    show(el('h1', { textContent: 'Слишком много попыток' }), el('p', { className: 'note', textContent: 'Попробуйте через 5 минут.' }), button('Закрыть', () => kiosk.close(), 'muted wide'));
    return;
  }
  if (!st.hasPin) return setPinFlow(menu);
  const pad = pinPad('Введите PIN', async (pin) => {
    const res = await kiosk.submitPin(pin);
    if (res.ok) menu();
    else if (res.locked) kiosk.close();
    else pad.error('Неверный PIN');
  });
}
void start();
