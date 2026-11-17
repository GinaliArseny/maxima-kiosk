import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../admin/server/app';
import { addUser } from '../../admin/server/auth';
import type { Doctor } from '../../src/data/schema';
import { makeContentRoot } from './helpers';

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

async function setup() {
  const usersFile = join(mkdtempSync(join(tmpdir(), 'kiosk-users-')), 'users.json');
  await addUser(usersFile, 'admin', 'верный-пароль', 4);
  const app = await buildApp({ contentRoot: makeContentRoot(), usersFile });
  apps.push(app);
  return app;
}

async function login(app: Awaited<ReturnType<typeof buildApp>>) {
  const res = await app.inject({ method: 'POST', url: '/admin/api/login', payload: { login: 'admin', password: 'верный-пароль' } });
  expect(res.statusCode).toBe(204);
  const sid = res.cookies.find((c) => c.name === 'ka_sid')!;
  return { cookie: `ka_sid=${sid.value}`, sid };
}

describe('HTTP API админки', () => {
  it('без входа API отвечает 401', async () => {
    const app = await setup();
    expect((await app.inject({ method: 'GET', url: '/admin/api/content/doctors.json' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/admin/api/me' })).statusCode).toBe(401);
  });

  it('вход с верным паролем открывает доступ, с неверным — 401 с русским текстом', async () => {
    const app = await setup();
    const bad = await app.inject({ method: 'POST', url: '/admin/api/login', payload: { login: 'admin', password: 'нет' } });
    expect(bad.statusCode).toBe(401);
    expect(bad.json().error).toBe('Неверный логин или пароль');
    const { cookie } = await login(app);
    const me = await app.inject({ method: 'GET', url: '/admin/api/me', headers: { cookie } });
    expect(me.json()).toEqual({ login: 'admin' });
  });

  it('после выхода сессия больше не действует', async () => {
    const app = await setup();
    const { cookie } = await login(app);
    await app.inject({ method: 'POST', url: '/admin/api/logout', headers: { cookie } });
    expect((await app.inject({ method: 'GET', url: '/admin/api/me', headers: { cookie } })).statusCode).toBe(401);
  });

  it('шестая попытка входа за минуту — 429', async () => {
    const app = await setup();
    const codes: number[] = [];
    for (let i = 0; i < 6; i++)
      codes.push((await app.inject({ method: 'POST', url: '/admin/api/login', payload: { login: 'admin', password: 'нет' } })).statusCode);
    expect(codes).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it('PUT невалидных данных → 422 с issues, валидных → 200 и новая версия', async () => {
    const app = await setup();
    const { cookie } = await login(app);
    const got = (await app.inject({ method: 'GET', url: '/admin/api/content/doctors.json', headers: { cookie } })).json();
    const doctors = got.data as Doctor[];
    const bad = await app.inject({
      method: 'PUT', url: '/admin/api/content/doctors.json', headers: { cookie },
      payload: { data: [{ ...doctors[0], fullName: '' }, ...doctors.slice(1)], baseVersion: got.version },
    });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().issues[0].path).toBe('doctors.0.fullName');
    const ok = await app.inject({
      method: 'PUT', url: '/admin/api/content/doctors.json', headers: { cookie },
      payload: { data: doctors, baseVersion: got.version },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().version).toMatch(/^[0-9a-f]{12}$/);
  });

  it('PUT со старой версией → 409', async () => {
    const app = await setup();
    const { cookie } = await login(app);
    const got = (await app.inject({ method: 'GET', url: '/admin/api/content/authorities.json', headers: { cookie } })).json();
    const put = () => app.inject({ method: 'PUT', url: '/admin/api/content/authorities.json', headers: { cookie }, payload: { data: got.data, baseVersion: got.version } });
    expect((await put()).statusCode).toBe(200);
    const second = await put();
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe('Данные изменились — обновите страницу');
  });

  it('неизвестный файл → 404', async () => {
    const app = await setup();
    const { cookie } = await login(app);
    expect((await app.inject({ method: 'GET', url: '/admin/api/content/passwd', headers: { cookie } })).statusCode).toBe(404);
  });

  it('загрузка PDF возвращает имя файла, и на него можно сослаться в documents.json', async () => {
    const app = await setup();
    const { cookie } = await login(app);
    const form = new FormData();
    form.append('file', new Blob([Buffer.from('%PDF-1.4\nustav')], { type: 'application/pdf' }), 'ustav.pdf');
    const up = await app.inject({ method: 'POST', url: '/admin/api/upload/pdf?hint=Устав', headers: { cookie }, body: form });
    expect(up.statusCode).toBe(200);
    const { file } = up.json();
    expect(file).toMatch(/^ustav-.*\.pdf$/);
    const got = (await app.inject({ method: 'GET', url: '/admin/api/content/documents.json', headers: { cookie } })).json();
    got.data[0].items.push({ kind: 'pdf', id: 'ustav', title: 'Устав', legalRefs: [21], file });
    const put = await app.inject({ method: 'PUT', url: '/admin/api/content/documents.json', headers: { cookie }, payload: { data: got.data, baseVersion: got.version } });
    expect(put.statusCode).toBe(200);
    const cov = (await app.inject({ method: 'GET', url: '/admin/api/coverage', headers: { cookie } })).json();
    expect(cov.find((r: { n: number }) => r.n === 21).status).toBe('covered');
  });

  it('cookie сессии httpOnly, SameSite=Strict и Path=/admin', async () => {
    const app = await setup();
    const { sid } = await login(app);
    expect(sid).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/admin' });
  });

  it('история: сохранение видно в списке и откатывается', async () => {
    const app = await setup();
    const { cookie } = await login(app);
    const got = (await app.inject({ method: 'GET', url: '/admin/api/content/clinic.json', headers: { cookie } })).json();
    await app.inject({ method: 'PUT', url: '/admin/api/content/clinic.json', headers: { cookie }, payload: { data: got.data, baseVersion: got.version } });
    const [entry] = (await app.inject({ method: 'GET', url: '/admin/api/history', headers: { cookie } })).json();
    expect(entry).toMatchObject({ user: 'admin', file: 'clinic.json' });
    expect((await app.inject({ method: 'POST', url: `/admin/api/history/${entry.id}/restore`, headers: { cookie } })).statusCode).toBe(204);
  });

  it('все ответы закрыты от поисковиков', async () => {
    const app = await setup();
    expect((await app.inject({ method: 'GET', url: '/admin/api/me' })).headers['x-robots-tag']).toBe('noindex, nofollow');
  });
});

it('файл пользователей без записей не пускает никого', async () => {
  const usersFile = join(mkdtempSync(join(tmpdir(), 'kiosk-users-')), 'users.json');
  writeFileSync(usersFile, '[]');
  const app = await buildApp({ contentRoot: makeContentRoot(), usersFile });
  apps.push(app);
  const res = await app.inject({ method: 'POST', url: '/admin/api/login', payload: { login: 'admin', password: 'x' } });
  expect(res.statusCode).toBe(401);
});

describe('Веб-админка отдаётся сервером', () => {
  async function withWeb() {
    const web = mkdtempSync(join(tmpdir(), 'kiosk-web-'));
    writeFileSync(join(web, 'index.html'), '<!doctype html><div id="root"></div>');
    mkdirSync(join(web, 'assets'));
    writeFileSync(join(web, 'assets', 'app-123.js'), 'console.log(1)');
    const usersFile = join(mkdtempSync(join(tmpdir(), 'kiosk-users-')), 'users.json');
    const app = await buildApp({ contentRoot: makeContentRoot(), usersFile, webDir: web });
    apps.push(app);
    return app;
  }

  it('сервер с собранной админкой запускается и отдаёт страницу на /admin/', async () => {
    const app = await withWeb();
    const res = await app.inject({ method: 'GET', url: '/admin/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('id="root"');
  });

  it('/admin без слэша ведёт на /admin/, сборочные файлы отдаются', async () => {
    const app = await withWeb();
    const bare = await app.inject({ method: 'GET', url: '/admin' });
    expect([200, 301, 302]).toContain(bare.statusCode);
    expect((await app.inject({ method: 'GET', url: '/admin/assets/app-123.js' })).statusCode).toBe(200);
  });

  it('неизвестный адрес API — 404, а не страница админки', async () => {
    const app = await withWeb();
    expect((await app.inject({ method: 'GET', url: '/admin/api/nope' })).statusCode).toBe(404);
  });
});
