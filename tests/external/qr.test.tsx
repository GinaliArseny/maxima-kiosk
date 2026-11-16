import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../helpers/renderApp';

describe('Внешние ссылки', () => {
  it('внешняя ссылка открывает QR, а не переход', async () => {
    renderApp({ route: '/contacts' });
    await userEvent.click(await screen.findByRole('button', { name: /maxima-sm\.ru/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('https://www.maxima-sm.ru')).toBeInTheDocument();
    expect(within(dialog).getByText(/Наведите камеру телефона/)).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole('img', { name: 'QR-код' })).toHaveAttribute('src', expect.stringMatching(/^data:image\/svg\+xml/)));
    expect(window.location.hash, 'остались на экране контактов').toBe('#/contacts');
  });

  it('QR закрывается кнопкой Закрыть', async () => {
    renderApp({ route: '/contacts' });
    await userEvent.click(await screen.findByRole('button', { name: /maxima-sm\.ru/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Закрыть/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
