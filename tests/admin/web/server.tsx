import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../../../admin/web/src/App';
import { buildApp } from '../../../admin/server/app';
import { addUser } from '../../../admin/server/auth';
import { ContentStore } from '../../../admin/server/contentStore';
import { makeContentRoot } from '../helpers';

/**
 * Настоящий сервер админки во временном каталоге; fetch браузера направлен в него
 * (граница сети). Cookie сессии переносится между запросами, как в браузере.
 */
export async function startAdmin() {
  const root = makeContentRoot();
  const usersFile = join(mkdtempSync(join(tmpdir(), 'kiosk-users-')), 'users.json');
  await addUser(usersFile, 'admin', 'верный-пароль', 4);
  const app = await buildApp({ contentRoot: root, usersFile });
  let cookie = '';
  const requests: { method: string; url: string; body?: unknown }[] = [];

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost/');
    const path = url.pathname.startsWith('/admin/') ? url.pathname : `/admin${url.pathname}`;
    const method = init.method ?? 'GET';
    const isForm = init.body instanceof FormData;
    requests.push({ method, url: path, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined });
    const res = await app.inject({
      method: method as 'GET',
      url: path + url.search,
      headers: { ...(init.headers as Record<string, string>), ...(cookie && { cookie }) },
      ...(isForm ? { body: init.body as FormData } : { payload: init.body as string | undefined }),
    });
    const set = res.cookies.find((c) => c.name === 'ka_sid');
    if (set) cookie = set.value ? `ka_sid=${set.value}` : '';
    const body = res.statusCode === 204 ? null : res.rawPayload;
    return new Response(body, { status: res.statusCode, headers: { 'content-type': String(res.headers['content-type'] ?? '') } });
  });

  return { app, root, store: new ContentStore(root), requests };
}

/** Рендер админки и вход под admin. */
export async function renderLoggedIn(route = '/') {
  const server = await startAdmin();
  window.location.hash = '#' + route;
  render(<App />);
  await userEvent.type(await screen.findByLabelText('Логин'), 'admin');
  await userEvent.type(screen.getByLabelText('Пароль'), 'верный-пароль');
  await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
  return server;
}
