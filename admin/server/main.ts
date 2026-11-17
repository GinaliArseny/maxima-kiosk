import { resolve } from 'node:path';
import { buildApp } from './app';

const env = (name: string, fallback?: string) => {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Не задана переменная окружения ${name}`);
  return v;
};

const app = await buildApp({
  contentRoot: env('CONTENT_ROOT', '/content'),
  usersFile: env('USERS_FILE', '/admin-data/users.json'),
  webDir: resolve(env('WEB_DIR', '/app/web')),
  secure: env('COOKIE_SECURE', '1') === '1',
});
await app.listen({ host: env('HOST', '0.0.0.0'), port: Number(env('PORT', '8787')) });
