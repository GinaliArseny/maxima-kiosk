import { useNavigate } from 'react-router-dom';
import type { DocItem } from '../data/schema';
import { ExternalLink } from '../external/ExternalLinkProvider';
import { IconDocSmall } from '../ui/icons';
import styles from './screens.module.css';

/** Элемент секции документов: pdf → просмотрщик, link → QR, text/notice → текст на месте. */
export function DocItemView({ item }: { item: DocItem }) {
  const navigate = useNavigate();
  switch (item.kind) {
    case 'pdf':
      return (
        <button type="button" className={styles.docRow} onClick={() => navigate(`/doc/${item.id}`)}>
          <span className={styles.docIcon} aria-hidden="true"><IconDocSmall /></span>
          <span className={styles.docTitle}>{item.title}</span>
          <span className={styles.docAction} aria-hidden="true">Открыть ›</span>
        </button>
      );
    case 'link':
      return (
        <div className={styles.docText}>
          <ExternalLink url={item.url} title={item.title}>
            {item.title}
          </ExternalLink>
        </div>
      );
    case 'text':
    case 'notice':
      return (
        <div className={item.kind === 'notice' ? `${styles.docText} ${styles.notice}` : styles.docText}>
          <h3>
            {item.kind === 'notice' && <span aria-hidden="true">ℹ️ </span>}
            {item.title}
          </h3>
          <p>{item.body}</p>
        </div>
      );
  }
}
