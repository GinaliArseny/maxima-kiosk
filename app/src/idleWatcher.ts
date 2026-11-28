export interface IdleWatcherOptions {
  /** Секунды без касаний по всей системе (powerMonitor.getSystemIdleTime). */
  getIdleSeconds: () => number;
  /** Порог включения заставки, сек (из настроек — может меняться). */
  thresholdSec: () => number;
  pollMs: number;
  /** Повторная попытка при непрерывном простое, например после сетевой ошибки. */
  retryMs?: number;
  onIdle: () => void;
  onActive: () => void;
}

/** Опрос простоя: onIdle — один раз при пересечении порога, onActive — один раз при первом касании после этого. */
export function createIdleWatcher(o: IdleWatcherOptions): { stop(): void } {
  let idle = false;
  let lastAttempt = 0;
  const timer = setInterval(() => {
    const secs = o.getIdleSeconds();
    if (secs >= o.thresholdSec() && (!idle || (o.retryMs !== undefined && Date.now() - lastAttempt >= o.retryMs))) {
      idle = true;
      lastAttempt = Date.now();
      o.onIdle();
    } else if (idle && secs < o.thresholdSec()) {
      idle = false;
      o.onActive();
    }
  }, o.pollMs);
  return { stop: () => clearInterval(timer) };
}
