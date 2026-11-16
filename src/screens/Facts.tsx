import type { ReactNode } from 'react';
import styles from './screens.module.css';

/** Список «подпись — значение»; пустые значения не выводятся. */
export function Facts({ rows }: { rows: [string, ReactNode | undefined | null][] }) {
  return (
    <dl className={styles.facts}>
      {rows
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}
