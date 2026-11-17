import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface User {
  login: string;
  hash: string;
}
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export async function readUsers(file: string): Promise<User[]> {
  return existsSync(file) ? (JSON.parse(await readFile(file, 'utf-8')) as User[]) : [];
}

/** Добавляет пользователя или меняет ему пароль. */
export async function addUser(file: string, login: string, password: string, rounds = 12): Promise<void> {
  if (!/^[a-z0-9._-]{2,32}$/i.test(login)) throw new Error('Логин: латиница, цифры, . _ -, от 2 до 32 символов');
  if (password.length < 8) throw new Error('Пароль не короче 8 символов');
  const users = (await readUsers(file)).filter((u) => u.login !== login);
  users.push({ login, hash: await bcrypt.hash(password, rounds) });
  await mkdir(dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, JSON.stringify(users, null, 2));
  await rename(`${file}.tmp`, file);
}

/** Проверка пароля; неизвестный логин тратит то же время, что и известный. */
export async function checkPassword(file: string, login: string, password: string): Promise<boolean> {
  const user = (await readUsers(file)).find((u) => u.login === login);
  const ok = await bcrypt.compare(password, user?.hash ?? '$2b$12$' + 'x'.repeat(53));
  return Boolean(user) && ok;
}

/** Сессии в памяти процесса: рестарт сервиса = повторный вход (допустимо для одного админа). */
export class Sessions {
  private readonly map = new Map<string, { login: string; exp: number }>();
  constructor(private readonly now: () => number = Date.now) {}

  create(login: string): string {
    const sid = randomBytes(32).toString('hex');
    this.map.set(sid, { login, exp: this.now() + SESSION_TTL_MS });
    return sid;
  }
  get(sid: string | undefined): string | null {
    const s = sid ? this.map.get(sid) : undefined;
    if (!s) return null;
    if (s.exp < this.now()) {
      this.map.delete(sid!);
      return null;
    }
    return s.login;
  }
  drop(sid: string | undefined) {
    if (sid) this.map.delete(sid);
  }
}
