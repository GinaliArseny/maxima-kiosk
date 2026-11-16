import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ScreenLayout } from '../ui/ScreenLayout';
import type { Tone } from '../ui/tone';
import { openPdf, type PdfDoc } from './pdfjsAdapter';
import styles from './pdf.module.css';

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const STEP = 0.5;
const SWIPE_PX = 80;

interface Props {
  url: string;
  title: string;
  tone?: Tone;
  open?: (url: string) => Promise<PdfDoc>;
}

export function PdfViewer({ url, title, tone, open = openPdf }: Props) {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(MIN_SCALE);
  const canvas = useRef<HTMLCanvasElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let alive = true;
    let loaded: PdfDoc | null = null;
    setDoc(null);
    setFailed(false);
    setPage(1);
    open(url).then(
      (d) => {
        if (!alive) return d.destroy();
        loaded = d;
        setDoc(d);
      },
      (e) => {
        console.error(e);
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
      loaded?.destroy();
    };
  }, [url, open]);

  useEffect(() => {
    if (!doc || !canvas.current) return;
    let current = true;
    doc.renderPage(page, canvas.current, scale).catch((e) => {
      console.error(e);
      // Ошибка рендера, который уже сменился другой страницей/масштабом, — не повод прятать документ.
      if (current) setFailed(true);
    });
    return () => {
      current = false;
    };
  }, [doc, page, scale]);

  const go = (delta: number) => doc && setPage((p) => Math.min(doc.numPages, Math.max(1, p + delta)));
  const zoom = (delta: number) => setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)));

  const onDown = (e: PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || scale > MIN_SCALE) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - s.y)) go(dx < 0 ? 1 : -1);
  };

  return (
    <ScreenLayout title={title} tone={tone}>
      {failed ? (
        <div className="fullscreen-message" role="alert">
          <h1>Документ временно недоступен</h1>
          <p>Попросите администратора показать бумажный экземпляр.</p>
        </div>
      ) : (
        <div className={styles.viewer}>
          <div
            className={scale > MIN_SCALE ? `${styles.stage} ${styles.zoomed}` : styles.stage}
            data-testid="pdf-stage"
            onPointerDown={onDown}
            onPointerUp={onUp}
          >
            {!doc && <div className={styles.loading} aria-busy="true">Загрузка документа…</div>}
            <canvas ref={canvas} className={styles.canvas} />
          </div>
          {doc && (
            <div className={styles.controls}>
              <button type="button" onClick={() => go(-1)} disabled={page <= 1}>
                ‹ Предыдущая
              </button>
              <span className={styles.indicator}>
                {page} / {doc.numPages}
              </span>
              <button type="button" onClick={() => go(1)} disabled={page >= doc.numPages}>
                Далее ›
              </button>
              <span className={styles.sep} />
              <button type="button" aria-label="Уменьшить" onClick={() => zoom(-STEP)} disabled={scale <= MIN_SCALE}>
                −
              </button>
              <span className={styles.indicator}>{Math.round(scale * 100)}%</span>
              <button type="button" aria-label="Увеличить" onClick={() => zoom(STEP)} disabled={scale >= MAX_SCALE}>
                +
              </button>
            </div>
          )}
        </div>
      )}
    </ScreenLayout>
  );
}
