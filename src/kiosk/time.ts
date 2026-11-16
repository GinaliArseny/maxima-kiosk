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

const WEEKDAY_BY_SHORT: Record<string, import('../data/schema').Weekday> = {
  Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun',
};

/** День недели в МСК. */
export function moscowWeekday(now: Date = new Date()) {
  const short = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' }).format(now);
  return WEEKDAY_BY_SHORT[short];
}

export const WEEKDAY_LABELS = { mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс' } as const;
