import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../helpers/renderApp';

const at = (iso: string) => vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(iso) });

describe('Главная', () => {
  it('показывает режим работы на сегодня', async () => {
    at('2026-11-20T12:00:00+03:00'); // пятница
    renderApp();
    expect(await screen.findByText('Сегодня: 8:30–21:00')).toBeInTheDocument();
  });

  it('день недели считается по Москве, а не по UTC', async () => {
    at('2026-11-21T22:30:00Z'); // сб 22:30 UTC = вс 01:30 МСК
    renderApp();
    expect(await screen.findByText('Сегодня выходной')).toBeInTheDocument();
  });

  it('воскресенье — выходной', async () => {
    at('2026-11-22T12:00:00+03:00');
    renderApp();
    expect(await screen.findByText('Сегодня выходной')).toBeInTheDocument();
  });

  it('плитка игры скрыта без gameUrl', async () => {
    renderApp({ clinic: { gameUrl: undefined } });
    await screen.findByText(/Добро пожаловать/);
    expect(screen.queryByText(/Игра для детей/)).not.toBeInTheDocument();
  });

  it('плитка игры ведёт на gameUrl в той же вкладке', async () => {
    renderApp({ clinic: { gameUrl: 'https://zub.example.ru/' } });
    const link = (await screen.findByText(/Игра для детей/)).closest('a');
    expect(link).toHaveAttribute('href', 'https://zub.example.ru/');
    expect(link).not.toHaveAttribute('target');
  });

  it('плитка Цены открывает прайс', async () => {
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: /Цены/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/doc/prices'));
  });

  it('плитка Цены скрыта без priceDocId', async () => {
    renderApp({ clinic: { priceDocId: undefined } });
    await screen.findByText(/Добро пожаловать/);
    expect(screen.queryByRole('button', { name: /Цены/ })).not.toBeInTheDocument();
  });

  it('плитки ведут на разделы', async () => {
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: /Врачи и расписание/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/doctors'));
  });
});

describe('Контакты', () => {
  it('показывают адрес, телефоны и режим работы', async () => {
    renderApp({ route: '/contacts' });
    expect(await screen.findByText(/ул\. Исаковского/)).toBeInTheDocument();
    expect(screen.getByText(/33-99-33/)).toBeInTheDocument();
    expect(screen.getByText('ortos@339933.net')).toBeInTheDocument();
    expect(screen.getByText('Вс')).toBeInTheDocument();
    expect(screen.getAllByText('выходной').length).toBeGreaterThan(0);
  });
});
