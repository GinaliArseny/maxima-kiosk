import { useCallback, useEffect, useState } from 'react';
import type { EditableFile } from '../../../../src/data/schema';
import { api, ApiAuthError, ApiValidationError, type HistoryEntry } from '../api';
import { useAuthLost } from '../auth';
import styles from '../ui/admin.module.css';

const WHAT: Record<EditableFile, string> = {
  'clinic.json': 'Клиника',
  'doctors.json': 'Врачи',
  'documents.json': 'Документы',
  'authorities.json': 'Надзорные органы',
  'screensaver.json': 'Заставка',
};
const when = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function History() {
  const lost = useAuthLost();
  const [list, setList] = useState<HistoryEntry[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(
    () => api.history().then(setList, (e) => e instanceof ApiAuthError && lost()),
    [lost],
  );
  useEffect(() => void load(), [load]);

  if (!list) return <p>Загрузка…</p>;
  return (
    <>
      <h2>История правок</h2>
      <p className={styles.muted}>Каждое сохранение — отдельная версия. «Вернуть эту версию» возвращает все данные киоска на тот момент.</p>
      {msg && <p className={msg.ok ? styles.ok : styles.err}>{msg.text}</p>}
      {list.length === 0 && <p>Правок пока не было.</p>}
      <ul className={styles.list} aria-label="Версии">
        {list.map((h, i) => (
          <li key={h.id} className={styles.listItem}>
            <span className={styles.grow}>
              {when(h.at)} · {h.user} · {WHAT[h.file] ?? h.file} {i === 0 && <span className={styles.tag}>сейчас на киоске</span>}
            </span>
            {i > 0 &&
              (confirm === h.id ? (
                <button
                  type="button"
                  className={styles.danger}
                  onClick={async () => {
                    setConfirm(null);
                    try {
                      await api.restore(h.id);
                      setMsg({ ok: true, text: 'Версия возвращена — на киоске через 1–3 минуты' });
                      await load();
                    } catch (e) {
                      if (e instanceof ApiAuthError) return lost();
                      setMsg({
                        ok: false,
                        text: e instanceof ApiValidationError ? `Эту версию вернуть нельзя: ${e.issues.map((x) => x.message).join('; ')}` : (e as Error).message,
                      });
                    }
                  }}
                >
                  Точно вернуть?
                </button>
              ) : (
                <button type="button" className={styles.secondary} onClick={() => setConfirm(h.id)}>
                  Вернуть эту версию
                </button>
              ))}
          </li>
        ))}
      </ul>
    </>
  );
}
