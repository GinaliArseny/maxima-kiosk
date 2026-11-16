import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

/** Минимальный интерфейс открытого документа — граница с pdf.js. */
export interface PdfDoc {
  numPages: number;
  /** Рисует страницу n (с 1) в canvas; scale=1 — страница целиком вписана в контейнер. */
  renderPage(n: number, canvas: HTMLCanvasElement, scale: number): Promise<void>;
}

/**
 * Открывает PDF через pdf.js (legacy-сборка — киоск может держать старый Chrome).
 * pdf.js грузится лениво, чтобы не тянуть его в основной бандл.
 */
export async function openPdf(url: string): Promise<PdfDoc> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ url, isEvalSupported: false }).promise;
  let task: { cancel(): void; promise: Promise<void> } | null = null;

  return {
    numPages: doc.numPages,
    async renderPage(n, canvas, scale) {
      task?.cancel();
      const page = await doc.getPage(n);
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
      }
    },
  };
}
