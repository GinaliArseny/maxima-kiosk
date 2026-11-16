import { useEffect, useState } from 'react';

export const TIME_ZONE = 'Europe/Moscow';

/** Сегодняшняя дата в МСК как YYYY-MM-DD. */
export function moscowDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE }).format(now);
}

/** Текущее время, обновляется раз в минуту. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
