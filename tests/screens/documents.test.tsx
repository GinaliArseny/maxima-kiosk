import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../helpers/renderApp';

describe('Документы и сведения', () => {
  it('показывают только секции экрана документов', async () => {
    renderApp({ route: '/documents' });
    expect(await screen.findByRole('heading', { name: 'Об организации' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Стандарты и клинические рекомендации' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Обращения и правила' })).not.toBeInTheDocument();
  });

  it('показывают реквизиты из clinic.json', async () => {
    renderApp({ route: '/documents' });
    const req = await screen.findByRole('region', { name: 'Реквизиты' });
    expect(within(req).getByText('6730004954')).toBeInTheDocument();
    expect(within(req).getByText('1026701428160')).toBeInTheDocument();
    expect(within(req).getByText(/Л041-01128-67\/00295102/)).toBeInTheDocument();
  });

  it('pdf-элемент ведёт в просмотрщик', async () => {
    renderApp({ route: '/documents' });
    await userEvent.click(await screen.findByRole('button', { name: /Выписка из ЕГРЮЛ/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/doc/egrul'));
  });

  it('ссылка на правовой портал открывает QR', async () => {
    renderApp({ route: '/documents' });
    await userEvent.click(await screen.findByRole('button', { name: /Официальный интернет-портал правовой информации/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('http://pravo.gov.ru/')).toBeInTheDocument();
  });

  it('текстовый элемент показывается сразу', async () => {
    renderApp({ route: '/documents' });
    expect(await screen.findByText(/указаны в договоре/)).toBeInTheDocument();
  });
});

describe('Права пациента и обращения', () => {
  it('показывают главврача, почтовый адрес и помещение для меддокументации', async () => {
    renderApp({ route: '/rights' });
    expect(await screen.findByText('Демо Главврач Иванович')).toBeInTheDocument();
    expect(screen.getByText('Пн, Ср 14:00–16:00 (демо)')).toBeInTheDocument();
    expect(screen.getByText(/Пн–Пт 9:00–18:00, кабинет администратора/)).toBeInTheDocument();
    expect(screen.getByText(/214000, г\. Смоленск, ул\. Исаковского, д\. 24 \(демо\)/)).toBeInTheDocument();
  });

  it('показывают все надзорные органы', async () => {
    renderApp({ route: '/rights' });
    expect(await screen.findByText(/Министерство здравоохранения Смоленской области/)).toBeInTheDocument();
    expect(screen.getByText(/Росздравнадзора/)).toBeInTheDocument();
    expect(screen.getByText(/Роспотребнадзора/)).toBeInTheDocument();
  });

  it('книга жалоб — как уведомление', async () => {
    renderApp({ route: '/rights' });
    expect(await screen.findByText(/находится у администратора/)).toBeInTheDocument();
  });

  it('секции документов здесь не показываются', async () => {
    renderApp({ route: '/rights' });
    await screen.findByRole('heading', { name: 'Обращения и правила' });
    expect(screen.queryByRole('heading', { name: 'Об организации' })).not.toBeInTheDocument();
  });
});
