import { useEffect, useState } from 'react';
import { WEEKDAYS, type Doctor } from '../../../../src/data/schema';
import { WEEKDAY_LABELS } from '../../../../src/kiosk/time';
import { uniqueSlug } from '../../../shared/slug';
import { bindField, DocForm, Field, useScrollIntoView, useDoc } from '../ui/form';
import { FileInput } from '../ui/FileInput';
import { ListControls, moveItem } from '../ui/ListControls';
import styles from '../ui/admin.module.css';

const blank = (): Doctor => ({ id: '', fullName: '', specialty: '', credentials: [], schedule: {} });

export function Doctors() {
  const doc = useDoc<Doctor[]>('doctors.json');
  const { data, update, issues } = doc;
  const [sel, setSel] = useState<number | null>(null);
  /** Индексы врачей, добавленных в этой правке: им id выдаётся по ФИО. */
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  // Ошибка у врача, карточка которого закрыта, — открываем её.
  useEffect(() => {
    const m = issues.map((i) => /^doctors\.(\d+)/.exec(i.path)).find(Boolean);
    if (m) setSel(Number(m[1]));
  }, [issues]);

  return (
    <>
      <h2>Врачи</h2>
      <p className={styles.muted}>Порядок здесь — порядок на киоске. Скрытые врачи на киоске не показываются.</p>
      <DocForm doc={doc}>
        <ul className={styles.list}>
          {data?.map((d, i) => (
            <li key={i} className={styles.listItem}>
              <span className={styles.grow}>
                <strong>{d.fullName || 'Новый врач'}</strong>
                <br />
                <span className={styles.muted}>{d.specialty}</span> {d.hidden && <span className={styles.tag}>скрыт</span>}
              </span>
              <ListControls
                index={i}
                count={data.length}
                move={(a, b) => {
                  update((list) => moveItem(list, a, b));
                  setSel(null);
                }}
                onEdit={() => setSel(i)}
                onDelete={() => {
                  update((list) => list.filter((_, j) => j !== i));
                  setSel(null);
                }}
              >
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => update((list) => list.map((x, j) => (j === i ? { ...x, hidden: x.hidden ? undefined : true } : x)))}
                >
                  {d.hidden ? 'Показать' : 'Скрыть'}
                </button>
              </ListControls>
            </li>
          ))}
        </ul>
        <div>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              const at = data?.length ?? 0;
              update((list) => [...list, blank()]);
              setFresh((f) => new Set(f).add(at));
              setSel(at);
            }}
          >
            Добавить врача
          </button>
        </div>
        {data && sel !== null && data[sel] && (
          <DoctorForm
            key={sel}
            index={sel}
            doctors={data}
            update={update}
            onName={(name) =>
              fresh.has(sel) &&
              update((list) =>
                list.map((x, j) => (j === sel ? { ...x, id: uniqueSlug(name, list.filter((_, k) => k !== j).map((o) => o.id)) } : x)),
              )
            }
          />
        )}
      </DocForm>
    </>
  );
}

function DoctorForm({
  index: i,
  doctors,
  update,
  onName,
}: {
  index: number;
  doctors: Doctor[];
  update: (fn: (d: Doctor[]) => Doctor[]) => void;
  onName: (name: string) => void;
}) {
  const d = doctors[i];
  const card = useScrollIntoView<HTMLElement>();
  const b = (path: (string | number)[], optional = false) => bindField(doctors, update, 'doctors', [i, ...path], { optional });
  const name = b(['fullName']);
  return (
    <section ref={card} className={styles.card} aria-label="Карточка врача">
      <h3>Карточка врача</h3>
      <div className={styles.row}>
        <Field
          label="ФИО"
          {...name}
          onChange={(v) => {
            name.onChange(v);
            onName(v);
          }}
        />
        <Field label="Специальность" {...b(['specialty'])} hint="Как в сертификате/аккредитации" />
      </div>
      <div className={styles.row}>
        {d.photo && <img src={`../${d.photo}`} alt="" width={96} height={96} style={{ borderRadius: 48, objectFit: 'cover' }} />}
        <FileInput
          label="Фото"
          kind="photo"
          hint={d.fullName || 'doctor'}
          accept="image/jpeg,image/png,image/webp"
          doneText={() => 'Фото загружено'}
          onUploaded={(file) => update((list) => list.map((x, j) => (j === i ? { ...x, photo: file } : x)))}
        />
        {d.photo && (
          <div>
            <button type="button" className={styles.secondary} onClick={() => update((list) => list.map((x, j) => (j === i ? { ...x, photo: undefined } : x)))}>
              Убрать фото
            </button>
          </div>
        )}
      </div>

      <h3>Образование и квалификация</h3>
      {d.credentials.map((_, k) => (
        <div key={k} className={styles.row}>
          <Field label={`Документ ${k + 1}: вид`} {...b(['credentials', k, 'kind'])} placeholder="Диплом / Сертификат / Аккредитация" />
          <Field label={`Документ ${k + 1}: сведения`} multiline {...b(['credentials', k, 'details'], true)} />
          <div>
            <button
              type="button"
              className={styles.danger}
              onClick={() => update((list) => list.map((x, j) => (j === i ? { ...x, credentials: x.credentials.filter((_, n) => n !== k) } : x)))}
            >
              Удалить документ
            </button>
          </div>
        </div>
      ))}
      <div>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => update((list) => list.map((x, j) => (j === i ? { ...x, credentials: [...x.credentials, { kind: '' }] } : x)))}
        >
          Добавить документ
        </button>
      </div>

      <h3>График приёма</h3>
      <div className={styles.row}>
        {WEEKDAYS.map((day) => (
          <Field key={day} label={`График: ${WEEKDAY_LABELS[day]}`} placeholder="не работает" {...b(['schedule', day], true)} />
        ))}
      </div>
    </section>
  );
}
