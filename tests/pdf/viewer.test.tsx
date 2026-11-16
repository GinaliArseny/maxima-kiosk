import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { PdfDoc } from '../../src/pdf/pdfjsAdapter';
import { PdfViewer } from '../../src/pdf/PdfViewer';
import { renderApp } from '../helpers/renderApp';

/** Фейковый документ на границе pdf.js: 3 страницы, рендер всегда успешен. */
const fakeOpen = (numPages = 3) =>
  vi.fn(async (): Promise<PdfDoc> => ({ numPages, renderPage: vi.fn(async () => {}), destroy: vi.fn() }));

const renderViewer = (open = fakeOpen()) =>
  render(
    <MemoryRouter>
      <PdfViewer url="docs/sample.pdf" title="Выписка из ЕГРЮЛ" open={open} />
    </MemoryRouter>,
  );

describe('Просмотрщик PDF', () => {
  it('показывает номер страницы', async () => {
    renderViewer();
    expect(await screen.findByText('1 / 3')).toBeInTheDocument();
  });

  it('кнопка Далее листает и выключается на последней', async () => {
    renderViewer();
    const next = await screen.findByRole('button', { name: /Далее/ });
    await userEvent.click(next);
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    await userEvent.click(next);
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(next).toBeDisabled();
  });

  it('свайп влево листает вперёд, вправо — назад', async () => {
    renderViewer();
    const stage = await screen.findByTestId('pdf-stage');
    fireEvent.pointerDown(stage, { clientX: 600, clientY: 500 });
    fireEvent.pointerUp(stage, { clientX: 200, clientY: 510 });
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    fireEvent.pointerDown(stage, { clientX: 200, clientY: 500 });
    fireEvent.pointerUp(stage, { clientX: 600, clientY: 500 });
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('короткий жест не листает', async () => {
    renderViewer();
    const stage = await screen.findByTestId('pdf-stage');
    fireEvent.pointerDown(stage, { clientX: 400, clientY: 500 });
    fireEvent.pointerUp(stage, { clientX: 350, clientY: 500 });
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('зум кнопками в пределах 100–300%', async () => {
    renderViewer();
    const plus = await screen.findByRole('button', { name: 'Увеличить' });
    for (let i = 0; i < 6; i++) await userEvent.click(plus);
    expect(screen.getByText('300%')).toBeInTheDocument();
    const minus = screen.getByRole('button', { name: 'Уменьшить' });
    for (let i = 0; i < 6; i++) await userEvent.click(minus);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('при увеличении свайп не листает', async () => {
    renderViewer();
    await userEvent.click(await screen.findByRole('button', { name: 'Увеличить' }));
    const stage = screen.getByTestId('pdf-stage');
    fireEvent.pointerDown(stage, { clientX: 600, clientY: 500 });
    fireEvent.pointerUp(stage, { clientX: 200, clientY: 500 });
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('ошибка загрузки — понятное сообщение', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderViewer(vi.fn(async () => Promise.reject(new Error('404'))));
    expect(await screen.findByText('Документ временно недоступен')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Назад/ })).toBeInTheDocument();
  });

  it('открывает документ по его адресу', async () => {
    const open = fakeOpen();
    renderViewer(open);
    await screen.findByText('1 / 3');
    expect(open).toHaveBeenCalledWith('docs/sample.pdf');
  });
});

describe('Быстрое листание', () => {
  it('сбой устаревшего рендера не делает документ «недоступным»', async () => {
    let failFirst!: (e: Error) => void;
    const renderPage = vi
      .fn<PdfDoc['renderPage']>()
      .mockImplementationOnce(() => new Promise<void>((_, reject) => (failFirst = reject)))
      .mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderViewer(vi.fn(async () => ({ numPages: 3, renderPage, destroy: vi.fn() })));
    await userEvent.click(await screen.findByRole('button', { name: /Далее/ }));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    failFirst(new Error('Cannot use the same canvas during multiple render() operations'));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('Документ временно недоступен')).not.toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });
});

describe('Освобождение ресурсов pdf.js', () => {
  it('уход с экрана освобождает документ', async () => {
    const doc: PdfDoc = { numPages: 2, renderPage: vi.fn(async () => {}), destroy: vi.fn() };
    const { unmount } = renderViewer(vi.fn(async () => doc));
    await screen.findByText('1 / 2');
    unmount();
    expect(doc.destroy).toHaveBeenCalledTimes(1);
  });

  it('документ, догрузившийся после ухода с экрана, тоже освобождается', async () => {
    const doc: PdfDoc = { numPages: 2, renderPage: vi.fn(async () => {}), destroy: vi.fn() };
    let resolve!: (d: PdfDoc) => void;
    const { unmount } = renderViewer(vi.fn(() => new Promise<PdfDoc>((r) => (resolve = r))));
    unmount();
    resolve(doc);
    await waitFor(() => expect(doc.destroy).toHaveBeenCalledTimes(1));
  });
});

describe('Маршрут документа', () => {
  it('неизвестный документ — экран документов', async () => {
    renderApp({ route: '/doc/nope' });
    expect(await screen.findByRole('heading', { name: 'Документы и сведения' })).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe('#/documents'));
  });
});
