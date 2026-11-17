import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Clinic, Screensaver } from '../../../src/data/schema';
import { renderLoggedIn } from './server';

afterEach(() => vi.unstubAllGlobals());

// Значения выдуманные.
const ID = 'aaaabbbbccccddddeeeeffff00001111';
const KEY = '0123456789abcdef0123456789abcdef';

describe('Веб-админка: заставка', () => {
  it('вставленная ссылка с ApiKey сохраняется только как ID — ключа нет в отправленных данных', async () => {
    const { store, requests } = await renderLoggedIn('/screensaver');
    await userEvent.click(await screen.findByLabelText('Заставка включена'));
    await userEvent.type(screen.getByLabelText('Ссылка из Jellyfin'), `https://video.example.ru/Items/${ID}/Download?ApiKey=${KEY}`);
    await userEvent.click(screen.getByRole('button', { name: 'Добавить ссылку' }));
    expect(within(screen.getByRole('list', { name: 'Что показывать' })).getByText(new RegExp(ID.slice(0, 8)))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await screen.findByText('Опубликовано — на киоске через 1–3 минуты');
    const saved = (await store.read('screensaver.json')).data as Screensaver;
    expect(saved).toMatchObject({ enabled: true, sources: [{ itemId: ID }] });
    const put = requests.find((r) => r.method === 'PUT' && r.url.endsWith('screensaver.json'))!;
    expect(JSON.stringify(put.body)).not.toContain(KEY);
  });

  it('нераспознанная ссылка показывает ошибку и не добавляется', async () => {
    await renderLoggedIn('/screensaver');
    await userEvent.type(await screen.findByLabelText('Ссылка из Jellyfin'), 'https://youtube.com/watch?v=1');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить ссылку' }));
    expect(
      screen.getByText('Не похоже на ссылку Jellyfin — откройте видео или плейлист в Jellyfin и скопируйте адрес'),
    ).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Что показывать' })).queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('Веб-админка: история', () => {
  it('откат версии из истории после подтверждения возвращает данные и добавляет запись', async () => {
    const { store } = await renderLoggedIn('/');
    const first = await store.read('clinic.json');
    await store.save('clinic.json', { ...(first.data as Clinic), email: 'v1@339933.net' }, first.version, 'admin');
    const second = await store.read('clinic.json');
    await store.save('clinic.json', { ...(second.data as Clinic), email: 'v2@339933.net' }, second.version, 'admin');

    await userEvent.click(await screen.findByRole('link', { name: 'История' }));
    const list = await screen.findByRole('list', { name: 'Версии' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    await userEvent.click(within(rows[1]).getByRole('button', { name: 'Вернуть эту версию' }));
    await userEvent.click(within(rows[1]).getByRole('button', { name: 'Точно вернуть?' }));
    expect(await screen.findByText('Версия возвращена — на киоске через 1–3 минуты')).toBeInTheDocument();
    expect(((await store.read('clinic.json')).data as Clinic).email).toBe('v1@339933.net');
    expect(within(screen.getByRole('list', { name: 'Версии' })).getAllByRole('listitem')).toHaveLength(3);
  });
});
