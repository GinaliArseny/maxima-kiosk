import { describe, expect, it } from 'vitest';
import { isAllowedUrl, isKioskHome } from '../src/navigation';

describe('Куда можно уйти из киоска', () => {
  it.each(['https://kiosk.339933.net/', 'https://kiosk.339933.net/#/doctors', 'https://emailer.339933.net/game/?stand=1'])(
    'разрешено: %s',
    (url) => expect(isAllowedUrl(url)).toBe(true),
  );

  it.each([
    'https://kiosk.339933.net/admin/',
    'https://kiosk.339933.net/admin',
    'http://kiosk.339933.net/',
    'https://kiosk.339933.net.evil.ru/',
    'https://maxima-sm.ru',
    'file:///C:/Windows',
    'javascript:alert(1)',
    'не ссылка',
  ])('запрещено: %s', (url) => expect(isAllowedUrl(url)).toBe(false));

  it('главная киоска — с хэшем «/» или без него; экраны и игра — не главная', () => {
    const home = 'https://kiosk.339933.net/';
    expect(isKioskHome('https://kiosk.339933.net/', home)).toBe(true);
    expect(isKioskHome('https://kiosk.339933.net/#/', home)).toBe(true);
    expect(isKioskHome('https://kiosk.339933.net/#/doctors', home)).toBe(false);
    expect(isKioskHome('https://emailer.339933.net/game/', home)).toBe(false);
  });
});
