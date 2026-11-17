/** Как часто пробуем снова открыть сайт, если сети нет. */
export const RETRY_MS = 15_000;

/**
 * Открыть сайт; не вышло — показать свою страницу «Подключаемся…» и повторять,
 * пока не получится (вместо белого экрана или страницы ошибки Chromium).
 */
export async function loadWithRetry(
  load: () => Promise<void>,
  showOffline: () => void,
  sleep: (ms: number) => Promise<void>,
  retryMs = RETRY_MS,
): Promise<void> {
  for (;;) {
    try {
      await load();
      return;
    } catch {
      showOffline();
      await sleep(retryMs);
    }
  }
}
