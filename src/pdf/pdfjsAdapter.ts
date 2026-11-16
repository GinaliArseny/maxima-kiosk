import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

/** Минимальный интерфейс открытого документа — граница с pdf.js. */
export interface PdfDoc {
  numPages: number;
  /** Рисует страницу n (с 1) в canvas; scale=1 — страница целиком вписана в контейнер. */
  renderPage(n: number, canvas: HTMLCanvasElement, scale: number): Promise<void>;
  /** Освобождает документ и его Web Worker. После вызова объект не используется. */
  destroy(): void;
}

/**
 * Открывает PDF через pdf.js (legacy-сборка — киоск может держать старый Chrome).
 * pdf.js грузится лениво, чтобы не тянуть его в основной бандл.
 */
export async function openPdf(url: string): Promise<PdfDoc> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const loading = pdfjs.getDocument({ url, isEvalSupported: false });
  const doc = await loading.promise;
  let task: { cancel(): void; promise: Promise<void> } | null = null;
  let queue: Promise<void> = Promise.resolve();
  let generation = 0;

  return {
    numPages: doc.numPages,
    destroy() {
      task?.cancel();
      // Уничтожает документ и воркер, созданный getDocument, — иначе за недели работы копятся сотни воркеров.
      void loading.destroy();
    },
    renderPage(n, canvas, scale) {
      // Рендеры в один canvas строго по очереди; устаревшие (страницу уже сменили) пропускаем.
      const gen = ++generation;
      task?.cancel();
      queue = queue.catch(() => {}).then(async () => {
        if (gen !== generation) return;
        const page = await doc.getPage(n);
        if (gen !== generation) return;
        const base = page.getViewport({ scale: 1 });
        const box = canvas.parentElement;
        const pad = 32;
        const fitW = box?.clientWidth ? (box.clientWidth - pad) / base.width : 1;
        const fitH = box?.clientHeight ? (box.clientHeight - pad) / base.height : fitW;
        const cssScale = Math.min(fitW, fitH) * scale;
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: cssScale * dpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        task = page.render({ canvasContext: canvas.getContext('2d')!, viewport });
        try {
          await task.promise;
        } catch (e) {
          if ((e as Error)?.name !== 'RenderingCancelledException') throw e;
        } finally {
          task = null;
        }
      });
      return queue;
    },
  };
}
