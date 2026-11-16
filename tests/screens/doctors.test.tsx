import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../helpers/renderApp';

describe('Врачи и расписание', () => {
  it('список врачей с ФИО и специальностью', async () => {
    renderApp({ route: '/doctors' });
    expect(await screen.findByText('Демо Анна Сергеевна')).toBeInTheDocument();
    expect(screen.getByText('Стоматология терапевтическая')).toBeInTheDocument();
    expect(screen.getByText('Демо Пётр Николаевич')).toBeInTheDocument();
  });

  it('карточка показывает квалификацию таблицей', async () => {
    renderApp({ route: '/doctors' });
    await userEvent.click(await screen.findByRole('button', { name: /Демо Анна Сергеевна/ }));
    const table = await screen.findByRole('table', { name: 'Образование и квалификация' });
    const rows = within(table).getAllByRole('row');
    expect(rows.length, 'шапка + 4 документа').toBe(5);
    expect(within(table).getByText('Аккредитация')).toBeInTheDocument();
    expect(within(table).getByText(/7724 031234567/)).toBeInTheDocument();
    expect(within(table).getByText(/Смоленская государственная медицинская академия/)).toBeInTheDocument();
  });

  it('карточка показывает график по дням', async () => {
    renderApp({ route: '/doctors/demo-terapevt' });
    const table = await screen.findByRole('table', { name: 'График приёма' });
    expect(within(table).getByText('Пн')).toBeInTheDocument();
    expect(within(table).getAllByText('8:30–14:30 (1 смена)').length).toBe(3);
  });

  it('частичные данные не дают пустых строк', async () => {
    renderApp({ route: '/doctors/demo-ortoped' });
    const schedule = await screen.findByRole('table', { name: 'График приёма' });
    expect(within(schedule).queryByText('Чт'), 'нерабочий день не выводится').not.toBeInTheDocument();
    expect(within(schedule).getByText('Сб')).toBeInTheDocument();
    const quals = screen.getByRole('table', { name: 'Образование и квалификация' });
    expect(within(quals).queryByText('Аккредитация')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it('неизвестный врач — назад к списку', async () => {
    renderApp({ route: '/doctors/nope' });
    expect(await screen.findByText('Демо Анна Сергеевна')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/doctors');
  });
});
