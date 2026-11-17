import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIdleWatcher } from '../src/idleWatcher';

afterEach(() => vi.useRealTimers());

/** Время простоя системы — граница ОС (powerMonitor), подменяем. */
function setup(threshold = 180) {
  vi.useFakeTimers();
  let idle = 0;
  const onIdle = vi.fn();
  const onActive = vi.fn();
  const w = createIdleWatcher({ getIdleSeconds: () => idle, thresholdSec: () => threshold, pollMs: 5000, onIdle, onActive });
  return { onIdle, onActive, w, set: (s: number) => (idle = s), tick: () => vi.advanceTimersByTime(5000) };
}

describe('Простой киоска → заставка', () => {
  it('порог пройден — заставка включается один раз, повторных вызовов нет', () => {
    const t = setup();
    t.set(179);
    t.tick();
    expect(t.onIdle).not.toHaveBeenCalled();
    t.set(180);
    t.tick();
    t.set(300);
    t.tick();
    t.tick();
    expect(t.onIdle).toHaveBeenCalledTimes(1);
  });

  it('касание после включения — onActive один раз, затем новый простой снова включает', () => {
    const t = setup();
    t.set(200);
    t.tick();
    t.set(0);
    t.tick();
    t.tick();
    expect(t.onActive).toHaveBeenCalledTimes(1);
    t.set(181);
    t.tick();
    expect(t.onIdle).toHaveBeenCalledTimes(2);
  });

  it('активность сразу после включения закрывает заставку', () => {
    const t = setup();
    t.set(180);
    t.tick();
    t.set(0);
    t.tick();
    expect(t.onActive).toHaveBeenCalledTimes(1);
  });

  it('stop() прекращает опрос', () => {
    const t = setup();
    t.w.stop();
    t.set(999);
    t.tick();
    expect(t.onIdle).not.toHaveBeenCalled();
  });
});
