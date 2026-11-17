import { useCallback, useEffect, useRef } from 'react';

/** Как часто киоск спрашивает у сервера версию данных. */
export const VERSION_POLL_MS = 60_000;

/**
 * Следит за data/version.json, который админка обновляет при каждом сохранении.
 * Возвращает функцию «данные на сервере изменились с момента загрузки страницы».
 * Первая удачная версия — эталон; 404 и сбои сети молча игнорируются.
 */
export function useContentVersion(fetchImpl?: typeof fetch, url = './data/version.json'): () => boolean {
  const baseline = useRef<string | null>(null);
  const stale = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await (fetchImpl ?? fetch)(url, { cache: 'no-store' });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: unknown };
        if (cancelled || typeof version !== 'string') return;
        if (baseline.current === null) baseline.current = version;
        else if (version !== baseline.current) stale.current = true;
      } catch {
        /* сеть или битый ответ — ждём следующей проверки */
      }
    };
    void check();
    const timer = setInterval(check, VERSION_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [fetchImpl, url]);

  return useCallback(() => stale.current, []);
}
