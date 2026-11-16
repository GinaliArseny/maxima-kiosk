import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CRASH_RELOAD_MS, KioskErrorBoundary } from '../../src/kiosk/KioskErrorBoundary';

function Boom(): never {
  throw new Error('сбой рендера');
}

describe('Аварийный экран', () => {
  it('сбой рендера показывает понятное сообщение вместо белого экрана', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <KioskErrorBoundary reload={vi.fn()}>
        <Boom />
      </KioskErrorBoundary>,
    );
    expect(screen.getByText('Информация временно недоступна')).toBeInTheDocument();
  });

  it('после сбоя страница сама перезагружается через 30 секунд', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    render(
      <KioskErrorBoundary reload={reload}>
        <Boom />
      </KioskErrorBoundary>,
    );
    await act(() => vi.advanceTimersByTimeAsync(CRASH_RELOAD_MS - 1));
    expect(reload).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('без сбоя показывает содержимое', () => {
    render(
      <KioskErrorBoundary reload={vi.fn()}>
        <p>всё хорошо</p>
      </KioskErrorBoundary>,
    );
    expect(screen.getByText('всё хорошо')).toBeInTheDocument();
  });
});
