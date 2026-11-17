import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Clinic, DocSection, Doctor } from '../../../src/data/schema';
import { renderLoggedIn } from './server';

afterEach(() => vi.unstubAllGlobals());

const save = () => userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
const published = () => screen.findByText('Опубликовано — на киоске через 1–3 минуты');
const doctorRow = (name: string) => screen.getByText(name).closest('li')!;

describe('Веб-админка: врачи', () => {
  it('скрытие врача сохраняет hidden: true', async () => {
    const { store } = await renderLoggedIn('/doctors');
    await screen.findByText('Миньков Александр Владимирович');
    await userEvent.click(within(doctorRow('Миньков Александр Владимирович')).getByRole('button', { name: 'Скрыть' }));
    await save();
    await published();
    const doctors = (await store.read('doctors.json')).data as Doctor[];
    expect(doctors.find((d) => d.fullName === 'Миньков Александр Владимирович')!.hidden).toBe(true);
  });

  it('новый врач с фото: фото загружается, врач появляется в данных после сохранения', async () => {
    const { store, root } = await renderLoggedIn('/doctors');
    await userEvent.click(await screen.findByRole('button', { name: 'Добавить врача' }));
    await userEvent.type(screen.getByLabelText('ФИО'), 'Иванова Анна Петровна');
    await userEvent.type(screen.getByLabelText('Специальность'), 'Стоматология детская');
    const jpg = await sharp({ create: { width: 800, height: 800, channels: 3, background: '#1ca3c6' } }).jpeg().toBuffer();
    await userEvent.upload(screen.getByLabelText('Фото'), new File([jpg], 'ivanova.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByText('Фото загружено')).toBeInTheDocument();
    await save();
    await published();
    const added = ((await store.read('doctors.json')).data as Doctor[]).find((d) => d.fullName === 'Иванова Анна Петровна')!;
    expect(added.id).toBe('ivanova-anna-petrovna');
    expect(added.photo).toMatch(/^doctors\/.+\.webp$/);
    expect(existsSync(join(root, added.photo!))).toBe(true);
  });

  it('порядок врачей меняется кнопками и сохраняется', async () => {
    const { store } = await renderLoggedIn('/doctors');
    const before = (await store.read('doctors.json')).data as Doctor[];
    await screen.findByText(before[1].fullName);
    await userEvent.click(within(doctorRow(before[1].fullName)).getByRole('button', { name: 'Выше' }));
    await save();
    await published();
    const after = (await store.read('doctors.json')).data as Doctor[];
    expect(after.slice(0, 2).map((d) => d.id)).toEqual([before[1].id, before[0].id]);
  });
});

describe('Веб-админка: документы и цены', () => {
  it('замена PDF документа сохраняет новое имя файла', async () => {
    const { store, root } = await renderLoggedIn('/documents');
    const sections = (await store.read('documents.json')).data as DocSection[];
    const rules = sections.flatMap((s) => s.items).find((i) => i.kind === 'pdf' && i.id !== 'prices')!;
    await userEvent.click(within((await screen.findByText(rules.title)).closest('li')!).getByRole('button', { name: 'Изменить' }));
    await userEvent.upload(screen.getByLabelText('PDF-файл'), new File(['%PDF-1.4\nновые правила'], 'rules.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(/Файл загружен/)).toBeInTheDocument();
    await save();
    await published();
    const after = ((await store.read('documents.json')).data as DocSection[]).flatMap((s) => s.items).find((i) => i.id === rules.id)!;
    expect(after.kind === 'pdf' && after.file).not.toBe(rules.kind === 'pdf' && rules.file);
    expect(existsSync(join(root, 'docs', (after as { file: string }).file))).toBe(true);
  });

  it('новый элемент со ссылкой без https:// показывает ошибку у поля «Ссылка»', async () => {
    await renderLoggedIn('/documents');
    const section = (await screen.findByRole('heading', { name: /Стандарты/ })).closest('section')!;
    await userEvent.click(within(section).getByRole('button', { name: 'Добавить' }));
    await userEvent.selectOptions(screen.getByLabelText('Вид'), 'link');
    await userEvent.type(screen.getByLabelText('Название'), 'Портал правовой информации');
    await userEvent.type(screen.getByLabelText('Ссылка'), 'pravo.gov.ru');
    await save();
    expect(await screen.findByText('Есть ошибки — исправьте отмеченные поля')).toBeInTheDocument();
    expect(screen.getByLabelText('Ссылка')).toHaveAccessibleDescription('Нужна ссылка вида https://…');
  });

  it('загрузка нового прайса меняет файл у элемента прайса', async () => {
    const { store } = await renderLoggedIn('/prices');
    const priceId = ((await store.read('clinic.json')).data as Clinic).priceDocId!;
    const fileOf = async () =>
      ((await store.read('documents.json')).data as DocSection[]).flatMap((s) => s.items).find((i) => i.id === priceId) as { file: string };
    const old = (await fileOf()).file;
    expect(await screen.findByText(old)).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText('Новый прайс (PDF)'), new File(['%PDF-1.4\nцены'], 'price.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText('Прайс обновлён — на киоске через 1–3 минуты')).toBeInTheDocument();
    expect((await fileOf()).file).not.toBe(old);
  });
});

describe('Веб-админка: открытая карточка видна', () => {
  it('«Изменить» прокручивает страницу к карточке врача', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    await renderLoggedIn('/doctors');
    await screen.findByText('Миньков Александр Владимирович');
    await userEvent.click(within(doctorRow('Миньков Александр Владимирович')).getByRole('button', { name: 'Изменить' }));
    expect(scroll.mock.contexts[0]).toBe(screen.getByRole('region', { name: 'Карточка врача' }));
  });

  it('«Изменить» прокручивает страницу к элементу документов', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    await renderLoggedIn('/documents');
    await userEvent.click(within((await screen.findAllByRole('listitem'))[0]).getByRole('button', { name: 'Изменить' }));
    expect(scroll.mock.contexts[0]).toBe(screen.getByRole('region', { name: 'Элемент документов' }));
  });
});
