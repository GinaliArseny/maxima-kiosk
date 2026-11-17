import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStallWatch } from '../src/stallWatch';

afterEach(() => vi.useRealTimers());

describe('Ролик завис посреди воспроизведения', () => {
  it('время ролика не растёт 20 с — ролик считается сломанным', () => {
    vi.useFakeTimers();
    let t = 0;
    const onStall = vi.fn();
    createStallWatch({ currentTime: () => t, onStall, checkMs: 5000, stallMs: 20_000 });
    t = 10;
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(20_000);
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it('ролик идёт — тревоги нет', () => {
    vi.useFakeTimers();
    let t = 0;
    const onStall = vi.fn();
    createStallWatch({ currentTime: () => t, onStall, checkMs: 5000, stallMs: 20_000 });
    for (let i = 0; i < 20; i++) {
      t += 5;
      vi.advanceTimersByTime(5000);
    }
    expect(onStall).not.toHaveBeenCalled();
  });

  it('stop() снимает наблюдение (следующий ролик — новое наблюдение)', () => {
    vi.useFakeTimers();
    const onStall = vi.fn();
    const w = createStallWatch({ currentTime: () => 0, onStall, checkMs: 5000, stallMs: 20_000 });
    w.stop();
    vi.advanceTimersByTime(60_000);
    expect(onStall).not.toHaveBeenCalled();
  });
});
