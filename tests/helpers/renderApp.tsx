import { render } from '@testing-library/react';
import { vi } from 'vitest';
import App from '../../src/App';
import type { Authority, Clinic, DocSection, Doctor } from '../../src/data/schema';
import { makeFakeFetch, readSeed } from './seed';

export interface RenderAppOptions {
  /** Поля clinic.json поверх сида (shallow merge). */
  clinic?: Partial<Clinic>;
  doctors?: Doctor[];
  sections?: DocSection[];
  authorities?: Authority[];
  /** Маршрут hash-роутера, напр. '/documents'. */
  route?: string;
  failFiles?: string[];
}

/** Подменяет сеть сидом с переопределениями и рендерит киоск целиком. */
export function stubNetwork(opts: RenderAppOptions = {}) {
  const seed = readSeed();
  const clinic = { ...(seed['clinic.json'] as Clinic), ...opts.clinic };
  vi.stubGlobal(
    'fetch',
    makeFakeFetch({
      files: {
        'clinic.json': clinic,
        ...(opts.doctors && { 'doctors.json': opts.doctors }),
        ...(opts.sections && { 'documents.json': opts.sections }),
        ...(opts.authorities && { 'authorities.json': opts.authorities }),
      },
      failFiles: opts.failFiles,
    }),
  );
}

export function renderApp(opts: RenderAppOptions = {}) {
  stubNetwork(opts);
  window.location.hash = '#' + (opts.route ?? '/');
  return render(<App />);
}
