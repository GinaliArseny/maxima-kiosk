import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../helpers/renderApp';

const suspension = { active: true, from: '2026-11-10', to: '2026-11-20', text: 'Санобработка: клиника закрыта' };
const at = (iso: string) => vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(iso) });

describe('Киоск-оболочка', () => {
  it('баннер приостановки виден в период на всех экранах', async () => {
    at('2026-11-16T12:00:00+03:00');
    renderApp({ clinic: { suspension } });
    expect(await screen.findByText(suspension.text)).toBeInTheDocument();
    window.location.hash = '#/documents';
    expect(await screen.findByRole('heading', { name: 'Документы и сведения' })).toBeInTheDocument();
    expect(screen.getByText(suspension.text)).toBeInTheDocument();
  });

  it('баннер действует включительно по последний день', async () => {
    at('2026-11-20T20:00:00+03:00');
    renderApp({ clinic: { suspension } });
    expect(await screen.findByText(suspension.text)).toBeInTheDocument();
  });

  it('баннер скрыт после окончания срока', async () => {
    at('2026-11-21T09:00:00+03:00');
    renderApp({ clinic: { suspension } });
    await screen.findByText(/Добро пожаловать/);
    expect(screen.queryByText(suspension.text)).not.toBeInTheDocument();
  });

  it('баннер скрыт если active=false', async () => {
    at('2026-11-16T12:00:00+03:00');
    renderApp({ clinic: { suspension: { ...suspension, active: false } } });
    await screen.findByText(/Добро пожаловать/);
    expect(screen.queryByText(suspension.text)).not.toBeInTheDocument();
  });

  it('демо-лента видна при demo=true', async () => {
    renderApp({ clinic: { demo: true } });
    expect(await screen.findByText('ДЕМО-ДАННЫЕ')).toBeInTheDocument();
  });

  it('демо-лента скрыта при demo=false', async () => {
    renderApp({ clinic: { demo: false } });
    await screen.findByText(/Добро пожаловать/);
    expect(screen.queryByText('ДЕМО-ДАННЫЕ')).not.toBeInTheDocument();
  });

  it('кнопка Главная возвращает на главную', async () => {
    renderApp({ route: '/documents' });
    await userEvent.click(await screen.findByRole('button', { name: /Главная/ }));
    expect(await screen.findByText(/Добро пожаловать/)).toBeInTheDocument();
  });

  it('на главной нет кнопок навигации назад', async () => {
    renderApp();
    await screen.findByText(/Добро пожаловать/);
    expect(screen.queryByRole('button', { name: /Назад/ })).not.toBeInTheDocument();
  });
});
