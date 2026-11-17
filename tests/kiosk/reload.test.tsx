import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExternalLinkProvider } from '../../src/external/ExternalLinkProvider';
import { IdleReset, RELOAD_AFTER_MS } from '../../src/kiosk/IdleReset';

/** Перезагрузка страницы — граница браузера, подменяем её. */
const mount = (reload: () => void) =>
  render(
    <MemoryRouter>
      <ExternalLinkProvider>
        <IdleReset reload={reload} />
      </ExternalLinkProvider>
    </MemoryRouter>,
  );

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('Свежесть киоска при долгой работе', () => {
  it('простой в первые полчаса не перезагружает страницу', async () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    mount(reload);
    await wait(90_000);
    expect(reload).not.toHaveBeenCalled();
  });

  it('после 30 минут работы простой перезагружает страницу — подтягиваются новые данные и сборка', async () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    mount(reload);
    await wait(RELOAD_AFTER_MS + 90_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('пока посетитель работает с киоском, перезагрузки нет', async () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    mount(reload);
    for (let t = 0; t < RELOAD_AFTER_MS + 120_000; t += 60_000) {
      window.dispatchEvent(new Event('pointerdown'));
      await wait(60_000);
    }
    expect(reload).not.toHaveBeenCalled();
  });
});

/** Сервер с version.json — граница сети. version=null → 404, 'down' → сеть упала. */
function serveVersion() {
  const state: { version: string | null | 'down' } = { version: 'a' };
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    if (!String(input).endsWith('version.json')) return new Response('nf', { status: 404 });
    if (state.version === 'down') throw new TypeError('Failed to fetch');
    if (state.version === null) return new Response('nf', { status: 404 });
    return new Response(JSON.stringify({ version: state.version }), { status: 200 });
  });
  return state;
}

describe('Изменения из админки доезжают до киоска', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('сохранение в админке: версия сменилась → перезагрузка в ближайший простой, а не через 30 минут', async () => {
    vi.useFakeTimers();
    const server = serveVersion();
    const reload = vi.fn();
    mount(reload);
    await wait(1_000);
    server.version = 'b';
    await wait(60_000 + 90_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('пока посетитель работает, смена версии не перезагружает', async () => {
    vi.useFakeTimers();
    const server = serveVersion();
    const reload = vi.fn();
    mount(reload);
    await wait(1_000);
    server.version = 'b';
    for (let t = 0; t < 5 * 60_000; t += 30_000) {
      window.dispatchEvent(new Event('pointerdown'));
      await wait(30_000);
    }
    expect(reload).not.toHaveBeenCalled();
  });

  it('version.json нет (404) — перезагрузки нет, работает только 30-минутный запасной таймер', async () => {
    vi.useFakeTimers();
    const server = serveVersion();
    server.version = null;
    const reload = vi.fn();
    mount(reload);
    await wait(10 * 60_000);
    expect(reload).not.toHaveBeenCalled();
  });

  it('первая удачная версия после сбоя сети не считается изменением', async () => {
    vi.useFakeTimers();
    const server = serveVersion();
    server.version = 'down';
    const reload = vi.fn();
    mount(reload);
    await wait(61_000);
    server.version = 'b';
    await wait(10 * 60_000);
    expect(reload).not.toHaveBeenCalled();
  });
});
