import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../helpers/renderApp';

const fake = () => vi.useFakeTimers({ shouldAdvanceTime: true });
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('Сброс по простою', () => {
  it('простой 90 с возвращает на главную', async () => {
    fake();
    renderApp({ route: '/contacts' });
    await screen.findByRole('heading', { name: 'Контакты' });
    await wait(90_000);
    expect(await screen.findByText(/Добро пожаловать/)).toBeInTheDocument();
  });

  it('касание сбрасывает таймер', async () => {
    fake();
    renderApp({ route: '/contacts' });
    await screen.findByRole('heading', { name: 'Контакты' });
    await wait(60_000);
    fireEvent.pointerDown(document.body);
    await wait(60_000);
    expect(screen.getByRole('heading', { name: 'Контакты' })).toBeInTheDocument();
  });

  it('простой закрывает открытый QR', async () => {
    fake();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp({ route: '/contacts' });
    await user.click(await screen.findByRole('button', { name: /maxima-sm\.ru/ }));
    await screen.findByRole('dialog');
    await wait(90_000);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/Добро пожаловать/)).toBeInTheDocument();
  });

  it('на главной простой ничего не ломает', async () => {
    fake();
    renderApp();
    await screen.findByText(/Добро пожаловать/);
    await wait(200_000);
    expect(screen.getByText(/Добро пожаловать/)).toBeInTheDocument();
  });
});
