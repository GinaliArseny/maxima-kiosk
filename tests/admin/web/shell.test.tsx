import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../../admin/web/src/App';
import type { Clinic } from '../../../src/data/schema';
import { renderLoggedIn, startAdmin } from './server';

afterEach(() => vi.unstubAllGlobals());

describe('Веб-админка: вход и главная', () => {
  it('без сессии показывается вход; после входа — главная с числом закрытых пунктов и списком незакрытых', async () => {
    await startAdmin();
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Войти' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Логин'), 'admin');
    await userEvent.type(screen.getByLabelText('Пароль'), 'верный-пароль');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Закрыто 19 из 26 пунктов стенда')).toBeInTheDocument();
    const missing = screen.getByRole('list', { name: 'Не закрыто' });
    expect(within(missing).getByText(/Устав/)).toBeInTheDocument();
    expect(within(missing).getAllByRole('listitem')).toHaveLength(7);
  });

  it('неверный пароль — понятная ошибка, вход не выполнен', async () => {
    await startAdmin();
    render(<App />);
    await userEvent.type(await screen.findByLabelText('Логин'), 'admin');
    await userEvent.type(screen.getByLabelText('Пароль'), 'не тот');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Неверный логин или пароль')).toBeInTheDocument();
  });
});

describe('Веб-админка: клиника', () => {
  it('ошибка проверки показывается у поля телефона', async () => {
    await renderLoggedIn('/clinic');
    const number = await screen.findByLabelText('Телефон 1: номер');
    await userEvent.clear(number);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText('Есть ошибки — исправьте отмеченные поля')).toBeInTheDocument();
    expect(number).toHaveAccessibleDescription('Обязательное поле');
  });

  it('успешное сохранение говорит, когда изменения появятся на киоске', async () => {
    const { store } = await renderLoggedIn('/clinic');
    const email = await screen.findByLabelText('Email');
    await userEvent.clear(email);
    await userEvent.type(email, 'info@339933.net');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText('Опубликовано — на киоске через 1–3 минуты')).toBeInTheDocument();
    expect(((await store.read('clinic.json')).data as Clinic).email).toBe('info@339933.net');
  });

  it('конфликт версий показывает баннер «обновите страницу»', async () => {
    const { store } = await renderLoggedIn('/clinic');
    await screen.findByLabelText('Email');
    const cur = await store.read('clinic.json');
    await store.save('clinic.json', { ...(cur.data as Clinic), email: 'other@339933.net' }, cur.version, 'owner');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText('Данные изменились — обновите страницу')).toBeInTheDocument();
  });
});

describe('Веб-админка: надзорные органы', () => {
  it('новый орган без телефона не сохраняется, ошибка у его поля', async () => {
    await renderLoggedIn('/authorities');
    await userEvent.click(await screen.findByRole('button', { name: 'Добавить орган' }));
    const names = screen.getAllByLabelText(/Орган \d+: название/);
    await userEvent.type(names[names.length - 1], 'Прокуратура');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    const phones = screen.getAllByLabelText(/Орган \d+: телефон/);
    expect(await screen.findByText('Есть ошибки — исправьте отмеченные поля')).toBeInTheDocument();
    expect(phones[phones.length - 1]).toHaveAccessibleDescription('Обязательное поле');
  });
});
