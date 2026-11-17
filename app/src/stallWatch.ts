export interface StallWatchOptions {
  /** Текущая позиция ролика, сек. */
  currentTime: () => number;
  onStall: () => void;
  checkMs: number;
  stallMs: number;
}

/**
 * Ролик «подвис» без события error (сеть или сервер замолчали посреди 5-гигабайтного файла):
 * позиция не растёт stallMs — onStall один раз. Иначе кадр замер бы до первого касания.
 */
export function createStallWatch(o: StallWatchOptions): { stop(): void } {
  let last = o.currentTime();
  let still = 0;
  const timer = setInterval(() => {
    const now = o.currentTime();
    if (now !== last) {
      last = now;
      still = 0;
      return;
    }
    still += o.checkMs;
    if (still >= o.stallMs) {
      clearInterval(timer);
      o.onStall();
    }
  }, o.checkMs);
  return { stop: () => clearInterval(timer) };
}
