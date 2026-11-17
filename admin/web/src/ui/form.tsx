import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { EditableFile } from '../../../../src/data/schema';
import { api, ApiAuthError, ApiConflictError, ApiValidationError, type Issue } from '../api';
import { useAuthLost } from '../auth';
import styles from './admin.module.css';

type Path = (string | number)[];

/** Неизменяемая запись по пути: setPath({a:[{b:1}]}, ['a',0,'b'], 2). undefined удаляет ключ. */
export function setPath<T>(obj: T, path: Path, value: unknown): T {
  if (!path.length) return value as T;
  const [key, ...rest] = path;
  const copy = (Array.isArray(obj) ? [...obj] : { ...(obj as object) }) as Record<string | number, unknown>;
  const next = setPath(copy[key], rest, value);
  if (next === undefined && !Array.isArray(copy)) delete copy[key];
  else copy[key] = next;
  return copy as T;
}
export const getPath = (obj: unknown, path: Path): unknown =>
  path.reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string | number, unknown>)[k]), obj);

interface FormCtx {
  issues: Issue[];
  register: (path: string, label: string) => void;
}
const IssuesContext = createContext<FormCtx>({ issues: [], register: () => {} });

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'invalid' | 'conflict' | 'error';

/** То, что нужно форме от документа, без привязки к типу данных. */
export interface DocState {
  issues: Issue[];
  status: SaveStatus;
  error: string;
  loaded: boolean;
  save: () => Promise<boolean>;
  load: () => Promise<void>;
}

/** Документ админки: загрузка, правка, сохранение = публикация. */
export function useDoc<T>(file: EditableFile) {
  const onAuthLost = useAuthLost();
  const [doc, setDoc] = useState<{ data: T; version: string } | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      setDoc(await api.getContent<T>(file));
      setDirty(false);
      setIssues([]);
      setStatus('idle');
    } catch (e) {
      if (e instanceof ApiAuthError) onAuthLost();
      else {
        setStatus('error');
        setError((e as Error).message);
      }
    }
  }, [file, onAuthLost]);
  useEffect(() => void load(), [load]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = useCallback((fn: (d: T) => T) => {
    setDoc((cur) => (cur ? { ...cur, data: fn(cur.data) } : cur));
    setDirty(true);
    setStatus('idle');
  }, []);

  const save = useCallback(
    async (override?: T) => {
      if (!doc) return false;
      setStatus('saving');
      try {
        const data = override ?? doc.data;
        const { version } = await api.putContent(file, data, doc.version);
        setDoc({ data, version });
        setIssues([]);
        setDirty(false);
        setStatus('saved');
        return true;
      } catch (e) {
        if (e instanceof ApiValidationError) {
          setIssues(e.issues);
          setStatus('invalid');
        } else if (e instanceof ApiConflictError) setStatus('conflict');
        else if (e instanceof ApiAuthError) onAuthLost();
        else {
          setError((e as Error).message);
          setStatus('error');
        }
        return false;
      }
    },
    [doc, file, onAuthLost],
  );

  return { data: doc?.data, loaded: Boolean(doc), update, save, load, issues, status, error, dirty };
}

/** Форма документа: ошибки у полей + панель сохранения. */
export function DocForm({
  doc,
  children,
}: {
  doc: DocState;
  children: ReactNode;
}) {
  const labels = useRef(new Map<string, string>());
  const register = useCallback((path: string, label: string) => void labels.current.set(path, label), []);
  if (!doc.loaded) return <p>{doc.status === 'error' ? doc.error : 'Загрузка…'}</p>;
  return (
    <IssuesContext.Provider value={{ issues: doc.issues, register }}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void doc.save();
        }}
        noValidate
      >
        {children}
        <SaveBar doc={doc} labels={labels.current} />
      </form>
    </IssuesContext.Provider>
  );
}

function SaveBar({
  doc,
  labels,
}: {
  doc: DocState;
  labels: Map<string, string>;
}) {
  return (
    <div className={styles.saveBar}>
      <button type="submit" className={styles.primary} disabled={doc.status === 'saving'}>
        Сохранить
      </button>
      <div aria-live="polite" className={styles.saveMsg}>
        {doc.status === 'saving' && 'Сохраняем…'}
        {doc.status === 'saved' && <span className={styles.ok}>Опубликовано — на киоске через 1–3 минуты</span>}
        {doc.status === 'invalid' && (
          <div className={styles.err}>
            <strong>Есть ошибки — исправьте отмеченные поля</strong>
            <ul>
              {doc.issues.map((i) => (
                <li key={i.path + i.message}>{labels.get(i.path) ? `${labels.get(i.path)}: ${i.message}` : i.message}</li>
              ))}
            </ul>
          </div>
        )}
        {doc.status === 'conflict' && (
          <span className={styles.err}>
            Данные изменились — обновите страницу{' '}
            <button type="button" onClick={() => void doc.load()}>
              Обновить
            </button>
          </span>
        )}
        {doc.status === 'error' && <span className={styles.err}>Не удалось сохранить: {doc.error}</span>}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  /** Путь ошибки сервера, напр. 'clinic.phones.0.number'. */
  path: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: 'text' | 'date' | 'email' | 'url' | 'number';
  placeholder?: string;
  hint?: string;
}

export function Field({ label, path, value, onChange, multiline, type = 'text', placeholder, hint }: FieldProps) {
  const { issues, register } = useContext(IssuesContext);
  const id = useId();
  const issue = issues.find((i) => i.path === path);
  useEffect(() => register(path, label), [path, label, register]);
  const common = {
    id,
    value,
    placeholder,
    'aria-invalid': Boolean(issue) || undefined,
    'aria-describedby': issue || hint ? `${id}-msg` : undefined,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {multiline ? <textarea rows={3} {...common} /> : <input type={type} {...common} />}
      {(issue || hint) && (
        <small id={`${id}-msg`} className={issue ? styles.fieldErr : styles.hint}>
          {issue ? issue.message : hint}
        </small>
      )}
    </div>
  );
}

/** Поле, привязанное к пути в данных документа. optional: пустая строка → поле удаляется. */
export function bindField<T>(
  data: T,
  update: (fn: (d: T) => T) => void,
  prefix: string,
  path: Path,
  opts: { optional?: boolean; emptyAs?: null } = {},
) {
  const raw = getPath(data, path);
  return {
    path: [prefix, ...path].join('.'),
    value: raw == null ? '' : String(raw),
    onChange: (v: string) =>
      update((d) =>
        setPath(d, path, v === '' ? (opts.emptyAs === null ? null : opts.optional ? undefined : '') : v),
      ),
  };
}
