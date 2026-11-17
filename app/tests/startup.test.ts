import { describe, expect, it, vi } from 'vitest';
import { loadWithRetry } from '../src/startup';

describe('Старт без сети', () => {
  it('загрузка упала — своя страница «Подключаемся…» и повтор; после успеха страница больше не показывается', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('ERR_INTERNET_DISCONNECTED')).mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined);
    const showOffline = vi.fn();
    const sleep = vi.fn(async () => {});
    await loadWithRetry(load, showOffline, sleep, 15_000);
    expect(load).toHaveBeenCalledTimes(3);
    expect(showOffline).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(15_000);
  });

  it('сеть есть — сразу сайт, без страницы ожидания', async () => {
    const showOffline = vi.fn();
    await loadWithRetry(async () => {}, showOffline, async () => {});
    expect(showOffline).not.toHaveBeenCalled();
  });
});
