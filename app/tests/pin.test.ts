import { describe, expect, it } from 'vitest';
import { hashPin, PinGuard, verifyPin } from '../src/pin';

describe('PIN выхода из киоска', () => {
  it('верный PIN подходит, неверный — нет; хэш не содержит PIN', () => {
    const stored = hashPin('2580');
    expect(stored).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(stored).not.toContain('2580');
    expect(verifyPin('2580', stored)).toBe(true);
    expect(verifyPin('0000', stored)).toBe(false);
  });

  it('PIN — только 4–8 цифр', () => {
    expect(() => hashPin('12a4')).toThrow();
    expect(() => hashPin('123')).toThrow();
    expect(() => hashPin('123456789')).toThrow();
  });

  it('битый сохранённый хэш не пускает и не падает', () => {
    expect(verifyPin('2580', 'мусор')).toBe(false);
  });

  it('5 неверных подряд блокируют жест на 5 минут, верный сбрасывает счётчик', () => {
    let now = 0;
    const guard = new PinGuard(() => now);
    for (let i = 0; i < 4; i++) guard.attempt(false);
    guard.attempt(true);
    for (let i = 0; i < 4; i++) guard.attempt(false);
    expect(guard.locked()).toBe(false);
    guard.attempt(false);
    expect(guard.locked()).toBe(true);
    now += 5 * 60_000 - 1;
    expect(guard.locked()).toBe(true);
    now += 1;
    expect(guard.locked()).toBe(false);
  });
});
