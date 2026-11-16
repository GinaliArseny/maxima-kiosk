import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import styles from './external.module.css';

export function QrModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then((svg) => {
      if (alive) setSrc('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    });
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className={styles.qr}>{src && <img src={src} alt="QR-код" />}</div>
        <p className={styles.hint}>Наведите камеру телефона на код, чтобы открыть страницу</p>
        <p className={styles.url}>{url}</p>
        <button type="button" className={styles.close} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
