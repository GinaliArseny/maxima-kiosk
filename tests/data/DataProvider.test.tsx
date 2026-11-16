import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { renderApp, stubNetwork } from '../helpers/renderApp';

describe('Загрузка данных киоска', () => {
  it('после загрузки показывает приветствие', async () => {
    renderApp();
    expect(await screen.findByText(/Добро пожаловать/)).toBeInTheDocument();
  });

  it('при ошибке показывает экран недоступности', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp({ failFiles: ['clinic.json'] });
    expect(await screen.findByText('Информация временно недоступна')).toBeInTheDocument();
  });

  it('повторяет загрузку каждые 30 секунд', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp({ failFiles: ['clinic.json'] });
    await screen.findByText('Информация временно недоступна');
    stubNetwork();
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(await screen.findByText(/Добро пожаловать/)).toBeInTheDocument();
  });
});

describe('Зависшая сеть', () => {
  it('пока данные грузятся, на экране видно, что идёт загрузка', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<App />);
    expect(screen.getByText(/Загрузка/)).toBeInTheDocument();
  });

  it('если данные не пришли за 10 секунд — экран недоступности, затем повтор', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<App />);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(await screen.findByText('Информация временно недоступна')).toBeInTheDocument();
    stubNetwork();
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(await screen.findByText(/Добро пожаловать/)).toBeInTheDocument();
  });
});
