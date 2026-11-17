import { useEffect, useId, useState } from 'react';
import type { DocItem, DocSection } from '../../../../src/data/schema';
import { REQUIREMENTS } from '../../../../src/legal/requirements';
import { uniqueSlug } from '../../../shared/slug';
import { bindField, DocForm, Field, FieldError, useDoc } from '../ui/form';
import { FileInput } from '../ui/FileInput';
import { ListControls, moveItem } from '../ui/ListControls';
import styles from '../ui/admin.module.css';

const KIND_LABEL: Record<DocItem['kind'], string> = {
  pdf: 'PDF-документ',
  link: 'Ссылка (на киоске — QR-код)',
  text: 'Текст',
  notice: 'Объявление',
};
/** Пункты, которые элемент документов может закрыть (без неприменимых и условных). */
const REFS = REQUIREMENTS.filter((r) => r.stand && !r.conditional);

type Sel = { s: number; i: number } | null;

function withKind(item: DocItem, kind: DocItem['kind']): DocItem {
  const base = { id: item.id, title: item.title, legalRefs: item.legalRefs };
  if (kind === 'pdf') return { ...base, kind, file: item.kind === 'pdf' ? item.file : '' };
  if (kind === 'link') return { ...base, kind, url: item.kind === 'link' ? item.url : '' };
  return { ...base, kind, body: item.kind === 'text' || item.kind === 'notice' ? item.body : '' };
}

export function Documents() {
  const doc = useDoc<DocSection[]>('documents.json');
  const { data, update, issues } = doc;
  const [sel, setSel] = useState<Sel>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    const m = issues.map((x) => /^documents\.(\d+)\.items\.(\d+)/.exec(x.path)).find(Boolean);
    if (m) setSel({ s: Number(m[1]), i: Number(m[2]) });
  }, [issues]);

  const setItems = (s: number, fn: (items: DocItem[]) => DocItem[]) =>
    update((secs) => secs.map((sec, k) => (k === s ? { ...sec, items: fn(sec.items) } : sec)));

  return (
    <>
      <h2>Документы</h2>
      <p className={styles.muted}>Разделы фиксированы, как на киоске. Внутри раздела можно добавлять, менять и переставлять документы.</p>
      <DocForm doc={doc}>
        {data?.map((sec, s) => (
          <section key={sec.id} className={styles.card}>
            <h3>
              {sec.title} <span className={styles.tag}>{sec.screen === 'rights' ? 'экран «Права пациента»' : 'экран «Документы»'}</span>
            </h3>
            <ul className={styles.list}>
              {sec.items.map((item, i) => (
                <li key={i} className={styles.listItem}>
                  <span className={styles.grow}>
                    {item.title || 'Новый элемент'} <span className={styles.tag}>{KIND_LABEL[item.kind]}</span>
                  </span>
                  <ListControls
                    index={i}
                    count={sec.items.length}
                    move={(a, b) => {
                      setItems(s, (items) => moveItem(items, a, b));
                      setSel(null);
                    }}
                    onEdit={() => setSel({ s, i })}
                    onDelete={() => {
                      setItems(s, (items) => items.filter((_, j) => j !== i));
                      setSel(null);
                    }}
                  />
                </li>
              ))}
            </ul>
            <div>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  setItems(s, (items) => [...items, { kind: 'pdf', id: '', title: '', legalRefs: [], file: '' }]);
                  setFresh((f) => new Set(f).add(`${s}.${sec.items.length}`));
                  setSel({ s, i: sec.items.length });
                }}
              >
                Добавить
              </button>
            </div>
          </section>
        ))}
        {data && sel && data[sel.s]?.items[sel.i] && (
          <ItemForm
            key={`${sel.s}.${sel.i}`}
            sections={data}
            at={sel}
            update={update}
            isFresh={fresh.has(`${sel.s}.${sel.i}`)}
          />
        )}
      </DocForm>
    </>
  );
}

function ItemForm({
  sections,
  at,
  update,
  isFresh,
}: {
  sections: DocSection[];
  at: { s: number; i: number };
  update: (fn: (d: DocSection[]) => DocSection[]) => void;
  isFresh: boolean;
}) {
  const item = sections[at.s].items[at.i];
  const kindId = useId();
  const path = ['documents', at.s, 'items', at.i].join('.');
  const setItem = (fn: (it: DocItem) => DocItem) =>
    update((secs) =>
      secs.map((sec, k) => (k === at.s ? { ...sec, items: sec.items.map((it, j) => (j === at.i ? fn(it) : it)) } : sec)),
    );
  const b = (key: string) => bindField(sections, update, 'documents', [at.s, 'items', at.i, key]);
  const title = b('title');
  const otherIds = sections.flatMap((sec, k) => sec.items.filter((_, j) => !(k === at.s && j === at.i)).map((it) => it.id));

  return (
    <section className={styles.card} aria-label="Элемент документов">
      <h3>{sections[at.s].title}: элемент</h3>
      <div className={styles.field}>
        <label htmlFor={kindId}>Вид</label>
        <select id={kindId} value={item.kind} onChange={(e) => setItem((it) => withKind(it, e.target.value as DocItem['kind']))}>
          {Object.entries(KIND_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Field
        label="Название"
        {...title}
        onChange={(v) => {
          title.onChange(v);
          if (isFresh) setItem((it) => ({ ...it, id: uniqueSlug(v, otherIds) }));
        }}
      />
      {item.kind === 'pdf' && (
        <>
          <p className={styles.muted}>Текущий файл: {item.file || 'не загружен'}</p>
          <FileInput
            label="PDF-файл"
            kind="pdf"
            hint={item.title || 'document'}
            accept="application/pdf"
            doneText={(f) => `Файл загружен: ${f}`}
            onUploaded={(file) => setItem((it) => ({ ...it, file }))}
          />
          <FieldError path={`${path}.file`} label="PDF-файл" />
        </>
      )}
      {item.kind === 'link' && <Field label="Ссылка" {...b('url')} placeholder="https://…" hint="На киоске покажется QR-кодом" />}
      {(item.kind === 'text' || item.kind === 'notice') && <Field label="Текст" multiline {...b('body')} />}
      <fieldset className={styles.card} style={{ boxShadow: 'none', border: '1px solid #dde3ea' }}>
        <legend>Закрывает пункты требований юристов</legend>
        {REFS.map((r) => (
          <label key={r.n} style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={item.legalRefs.includes(r.n)}
              onChange={(e) =>
                setItem((it) => ({
                  ...it,
                  legalRefs: e.target.checked ? [...it.legalRefs, r.n].sort((x, y) => x - y) : it.legalRefs.filter((n) => n !== r.n),
                }))
              }
            />{' '}
            п. {r.n} — {r.title}
          </label>
        ))}
      </fieldset>
    </section>
  );
}
