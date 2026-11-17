/** Хосты, на которые программа-киоск может перейти: сам стенд и детская игра. */
export const ALLOWED_HOSTS = ['kiosk.339933.net', 'emailer.339933.net'] as const;

/** Разрешён ли переход: только https, только свои хосты, админка — никогда. */
export function isAllowedUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (!(ALLOWED_HOSTS as readonly string[]).includes(u.hostname)) return false;
  if (u.hostname === 'kiosk.339933.net' && /^\/admin(\/|$)/.test(u.pathname)) return false;
  return true;
}

/** Открыта ли главная стенда (а не экран раздела или игра). */
export function isKioskHome(url: string, kioskUrl: string): boolean {
  try {
    const u = new URL(url);
    const home = new URL(kioskUrl);
    return u.origin === home.origin && u.pathname === home.pathname && (u.hash === '' || u.hash === '#/' || u.hash === '#');
  } catch {
    return false;
  }
}
