import { describe, expect, it, vi } from 'vitest';
import { createCornerGesture } from '../src/cornerGesture';

const setup = () => {
  let now = 0;
  const onTrigger = vi.fn();
  const tap = createCornerGesture({ taps: 5, windowMs: 3000, zone: 100, now: () => now, onTrigger });
  return { tap, onTrigger, advance: (ms: number) => (now += ms) };
};

describe('Скрытый жест выхода: 5 касаний в левом верхнем углу', () => {
  it('5 касаний в углу за 2.9 с открывают PIN один раз', () => {
    const { tap, onTrigger, advance } = setup();
    for (let i = 0; i < 5; i++) {
      tap(20, 30);
      advance(700);
    }
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('4 касания — ничего', () => {
    const { tap, onTrigger } = setup();
    for (let i = 0; i < 4; i++) tap(20, 30);
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('5 касаний, растянутые на 3.5 с, — ничего', () => {
    const { tap, onTrigger, advance } = setup();
    for (let i = 0; i < 5; i++) {
      tap(20, 30);
      advance(875);
    }
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('касание вне угла сбрасывает серию', () => {
    const { tap, onTrigger } = setup();
    tap(10, 10);
    tap(10, 10);
    tap(500, 400);
    tap(10, 10);
    tap(10, 10);
    tap(10, 10);
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('после срабатывания серия начинается заново', () => {
    const { tap, onTrigger } = setup();
    for (let i = 0; i < 9; i++) tap(10, 10);
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });
});
