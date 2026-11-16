import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { QrModal } from './QrModal';
import styles from './external.module.css';

interface ExternalLinkApi {
  open(url: string, title: string): void;
  close(): void;
}

const Ctx = createContext<ExternalLinkApi | null>(null);

/** Внешние адреса в киоске не открываются — показываем QR для телефона. */
export function ExternalLinkProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ url: string; title: string } | null>(null);
  const open = useCallback((url: string, title: string) => setTarget({ url, title }), []);
  const close = useCallback(() => setTarget(null), []);
  const api = useMemo(() => ({ open, close }), [open, close]);
  return (
    <Ctx.Provider value={api}>
      {children}
      {target && <QrModal url={target.url} title={target.title} onClose={close} />}
    </Ctx.Provider>
  );
}

export function useExternalLink(): ExternalLinkApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useExternalLink вне ExternalLinkProvider');
  return api;
}

/** Кнопка-ссылка на внешний ресурс: по нажатию — QR-модал. */
export function ExternalLink({ url, title, children }: { url: string; title: string; children?: ReactNode }) {
  const { open } = useExternalLink();
  return (
    <button type="button" className={styles.link} onClick={() => open(url, title)}>
      {children ?? url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
      <span className={styles.qrBadge} aria-hidden="true">QR</span>
    </button>
  );
}
