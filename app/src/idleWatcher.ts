export interface IdleWatcherOptions {
  /** Секунды без касаний по всей системе (powerMonitor.getSystemIdleTime). */
  getIdleSeconds: () => number;
  /** Порог включения заставки, сек (из настроек — может меняться). */
  thresholdSec: () => number;
  pollMs: number;
  onIdle: () => void;
  onActive: () => void;
}

/** Опрос простоя: onIdle — один раз при пересечении порога, onActive — один раз при первом касании после этого. */
export function createIdleWatcher(o: IdleWatcherOptions): { stop(): void } {
  let idle = false;
  const timer = setInterval(() => {
    const secs = o.getIdleSeconds();
    if (!idle && secs >= o.thresholdSec()) {
      idle = true;
      o.onIdle();
    } else if (idle && secs < o.thresholdSec()) {
      idle = false;
      o.onActive();
    }
  }, o.pollMs);
  return { stop: () => clearInterval(timer) };
}
