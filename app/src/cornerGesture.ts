export interface CornerGestureOptions {
  taps: number;
  windowMs: number;
  /** Сторона квадрата в левом верхнем углу, px. */
  zone: number;
  now: () => number;
  onTrigger: () => void;
}

/**
 * Скрытый жест выхода: `taps` касаний в углу за `windowMs`. Касание вне угла сбрасывает серию.
 * Возвращает обработчик касания (координаты окна).
 */
export function createCornerGesture(o: CornerGestureOptions): (x: number, y: number) => void {
  let times: number[] = [];
  return (x, y) => {
    if (x > o.zone || y > o.zone) {
      times = [];
      return;
    }
    const t = o.now();
    times = [...times.filter((s) => t - s < o.windowMs), t];
    if (times.length >= o.taps) {
      times = [];
      o.onTrigger();
    }
  };
}
