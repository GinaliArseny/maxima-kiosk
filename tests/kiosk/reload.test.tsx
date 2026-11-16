import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
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
