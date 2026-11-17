import { useEffect, useState } from 'react';
import type { CoverageRow } from '../../../../src/legal/coverage';
import { api, ApiAuthError } from '../api';
import { useAuthLost } from '../auth';
import styles from '../ui/admin.module.css';

export function Dashboard() {
  const [rows, setRows] = useState<CoverageRow[] | null>(null);
  const lost = useAuthLost();
  useEffect(() => {
    api.coverage().then(setRows, (e) => e instanceof ApiAuthError && lost());
  }, [lost]);
  if (!rows) return <p>Загрузка…</p>;

  const required = rows.filter((r) => r.status === 'covered' || r.status === 'missing');
  const missing = required.filter((r) => r.status === 'missing');
  return (
    <>
      <h2>Требования юристов к стенду</h2>
      <p className={styles.big}>
        Закрыто {required.length - missing.length} из {required.length} пунктов стенда
      </p>
      {missing.length > 0 ? (
        <>
          <p className={styles.muted}>Чтобы закрыть пункт, загрузите документ или заполните сведения в нужном разделе.</p>
          <ul className={styles.list} aria-label="Не закрыто">
            {missing.map((r) => (
              <li key={r.n} className={styles.listItem}>
                <span className={styles.tag}>п. {r.n}</span>
                <span className={styles.grow}>{r.title}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.ok}>Все пункты закрыты.</p>
      )}
    </>
  );
}
