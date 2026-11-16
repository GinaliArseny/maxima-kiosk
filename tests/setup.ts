import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom не реализует PointerEvent — без него теряются clientX/clientY в жестах.
if (!('PointerEvent' in window)) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'touch';
    }
  }
  // @ts-expect-error — полифил для тестовой среды
  window.PointerEvent = PointerEventPolyfill;
}

// Граница pdf.js: в jsdom нет canvas и воркеров — по умолчанию одностраничный фейк.
vi.mock('../src/pdf/pdfjsAdapter', () => ({
  openPdf: vi.fn(async () => ({ numPages: 1, renderPage: async () => {}, destroy: () => {} })),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.location.hash = '';
});
