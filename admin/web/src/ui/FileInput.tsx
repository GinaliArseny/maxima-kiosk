import { useId, useState } from 'react';
import { api, ApiValidationError } from '../api';
import styles from './admin.module.css';

/** Загрузка файла на сервер сразу при выборе; onUploaded получает имя/путь файла. */
export function FileInput({
  label,
  kind,
  hint,
  accept,
  doneText,
  onUploaded,
}: {
  label: string;
  kind: 'pdf' | 'photo';
  hint: string;
  accept: string;
  doneText: (file: string) => string;
  onUploaded: (file: string) => void | Promise<void>;
}) {
  const id = useId();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setMsg({ ok: true, text: 'Загружаем…' });
          try {
            const name = await api.upload(kind, file, hint);
            await onUploaded(name);
            setMsg({ ok: true, text: doneText(name) });
          } catch (err) {
            setMsg({ ok: false, text: err instanceof ApiValidationError ? err.issues.map((i) => i.message).join('; ') : (err as Error).message });
          }
        }}
      />
      {msg && <small className={msg.ok ? styles.ok : styles.fieldErr}>{msg.text}</small>}
    </div>
  );
}
