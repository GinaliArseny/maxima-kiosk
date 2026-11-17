import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEYLEN = 32;
export const MAX_ERRORS = 5;
export const LOCK_MS = 5 * 60_000;

/** Хэш PIN для локального конфига: 'scrypt$<соль>$<хэш>'. PIN — 4–8 цифр. */
export function hashPin(pin: string): string {
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN — от 4 до 8 цифр');
  const salt = randomBytes(16);
  return ['scrypt', salt.toString('hex'), scryptSync(pin, salt, KEYLEN).toString('hex')].join('$');
}

export function verifyPin(pin: string, stored: string): boolean {
  const [kind, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !hash || hash.length !== KEYLEN * 2) return false;
  const got = scryptSync(pin, Buffer.from(salt, 'hex'), KEYLEN);
  return timingSafeEqual(got, Buffer.from(hash, 'hex'));
}

/** Подбор PIN: после 5 ошибок подряд жест выхода не работает 5 минут. */
export class PinGuard {
  private errors = 0;
  private lockedUntil = 0;
  constructor(private readonly now: () => number = Date.now) {}

  attempt(ok: boolean): void {
    if (ok) {
      this.errors = 0;
      return;
    }
    if (++this.errors >= MAX_ERRORS) {
      this.errors = 0;
      this.lockedUntil = this.now() + LOCK_MS;
    }
  }

  locked(): boolean {
    return this.now() < this.lockedUntil;
  }
}
