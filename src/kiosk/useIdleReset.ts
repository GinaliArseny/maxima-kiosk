import { useEffect, useRef } from 'react';

const EVENTS = ['pointerdown', 'touchstart', 'keydown', 'wheel'] as const;

/** Вызывает onIdle, если timeoutMs не было касаний. Таймер перезапускается после срабатывания. */
export function useIdleReset(timeoutMs: number, onIdle: () => void): void {
  const cb = useRef(onIdle);
  cb.current = onIdle;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        cb.current();
        arm();
      }, timeoutMs);
    };
    arm();
    EVENTS.forEach((e) => window.addEventListener(e, arm, { passive: true, capture: true }));
    return () => {
      clearTimeout(timer);
      EVENTS.forEach((e) => window.removeEventListener(e, arm, { capture: true }));
    };
  }, [timeoutMs]);
}
