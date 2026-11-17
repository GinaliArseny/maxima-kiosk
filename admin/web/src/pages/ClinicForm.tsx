import { useEffect, useId, useState } from 'react';
import { WEEKDAYS, type Clinic, type DocSection } from '../../../../src/data/schema';
import { WEEKDAY_LABELS } from '../../../../src/kiosk/time';
import { api } from '../api';
import { bindField, DocForm, Field, setPath, useDoc } from '../ui/form';
import styles from '../ui/admin.module.css';

/** Выбор документа из documents.json (прайс, лицензия). */
function DocSelect({ label, value, onChange, items }: { label: string; value: string; onChange: (v: string) => void; items: { id: string; title: string }[] }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— не выбран —</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.title}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ClinicForm() {
  const doc = useDoc<Clinic>('clinic.json');
  const { data, update } = doc;
  const [pdfs, setPdfs] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    api.getContent<DocSection[]>('documents.json').then(
      ({ data: sections }) => setPdfs(sections.flatMap((s) => s.items.filter((i) => i.kind === 'pdf'))),
      () => {},
    );
  }, []);

  if (!data) return <DocForm doc={doc}>{null}</DocForm>;
  const b = (path: (string | number)[], optional = false) => bindField(data, update, 'clinic', path, { optional });
  const s = data.suspension;

  return (
    <>
      <h2>Сведения о клинике</h2>
      <DocForm doc={doc}>
        <section className={styles.card}>
          <h3>Организация</h3>
          <Field label="Краткое название" {...b(['shortName'])} />
          <Field label="Полное наименование юрлица" {...b(['legalName'])} multiline />
          <Field label="Юридический адрес (по ЕГРЮЛ)" {...b(['legalAddress'])} />
          <div className={styles.row}>
            <Field label="ОГРН" {...b(['ogrn'])} />
            <Field label="ИНН" {...b(['inn'])} />
            <Field label="КПП" {...b(['kpp'], true)} />
          </div>
          <div className={styles.row}>
            <Field label="Email" {...b(['email'])} />
            <Field label="Сайт" {...b(['site'])} placeholder="https://…" />
          </div>
          <Field label="Почтовый адрес для обращений и жалоб" {...b(['postalAddress'], true)} />
        </section>

        <section className={styles.card}>
          <h3>Телефоны</h3>
          {data.phones.map((_, i) => (
            <div key={i} className={styles.row}>
              <Field label={`Телефон ${i + 1}: подпись`} {...b(['phones', i, 'label'])} placeholder="Регистратура" />
              <Field label={`Телефон ${i + 1}: номер`} {...b(['phones', i, 'number'])} />
              <div>
                <button type="button" className={styles.danger} onClick={() => update((d) => ({ ...d, phones: d.phones.filter((_, j) => j !== i) }))}>
                  Удалить
                </button>
              </div>
            </div>
          ))}
          <div>
            <button type="button" className={styles.secondary} onClick={() => update((d) => ({ ...d, phones: [...d.phones, { label: '', number: '' }] }))}>
              Добавить телефон
            </button>
          </div>
        </section>

        {data.addresses.map((_, i) => (
          <section key={i} className={styles.card}>
            <h3>Адрес {i + 1} и режим работы</h3>
            <Field label={`Адрес ${i + 1}`} {...b(['addresses', i, 'address'])} />
            <div className={styles.row}>
              {WEEKDAYS.map((d) => (
                <Field
                  key={d}
                  label={`${WEEKDAY_LABELS[d]}`}
                  placeholder="выходной"
                  {...bindField(data, update, 'clinic', ['addresses', i, 'hours', d], { emptyAs: null })}
                />
              ))}
            </div>
            {data.addresses.length > 1 && (
              <div>
                <button type="button" className={styles.danger} onClick={() => update((c) => ({ ...c, addresses: c.addresses.filter((_, j) => j !== i) }))}>
                  Удалить адрес
                </button>
              </div>
            )}
          </section>
        ))}

        <section className={styles.card}>
          <h3>Главный врач</h3>
          <Field label="ФИО главного врача" {...b(['chiefDoctor', 'fullName'])} />
          <div className={styles.row}>
            <Field label="Телефон главного врача" {...b(['chiefDoctor', 'phone'], true)} />
            <Field label="График приёма главного врача" {...b(['chiefDoctor', 'receptionHours'], true)} />
          </div>
          <Field label="Режим помещения для ознакомления с меддокументацией" {...b(['recordsRoomHours'], true)} />
        </section>

        <section className={styles.card}>
          <h3>Лицензия</h3>
          <div className={styles.row}>
            <Field label="Номер лицензии" {...b(['license', 'number'])} />
            <Field label="Дата лицензии" {...b(['license', 'date'])} />
          </div>
          <Field label="Кем выдана" {...b(['license', 'issuer'], true)} />
          <Field label="Срок действия" {...b(['license', 'validity'], true)} placeholder="бессрочно" />
          <DocSelect
            label="PDF лицензии (из раздела «Документы»)"
            items={pdfs}
            value={data.license.docId ?? ''}
            onChange={(v) => update((c) => setPath(c, ['license', 'docId'], v || undefined))}
          />
        </section>

        <section className={styles.card}>
          <h3>Прочее</h3>
          <DocSelect label="Прайс (из раздела «Документы»)" items={pdfs} value={data.priceDocId ?? ''} onChange={(v) => update((c) => setPath(c, ['priceDocId'], v || undefined))} />
          <Field label="Ссылка на детскую игру" {...b(['gameUrl'], true)} hint="Пусто — плитки игры на киоске нет" />
        </section>

        <section className={styles.card}>
          <h3>Приостановка работы</h3>
          <label>
            <input
              type="checkbox"
              checked={Boolean(s?.active)}
              onChange={(e) =>
                update((c) => ({
                  ...c,
                  suspension: e.target.checked
                    ? { from: '', to: '', text: '', ...c.suspension, active: true }
                    : c.suspension && (c.suspension.from || c.suspension.text)
                      ? { ...c.suspension, active: false }
                      : undefined,
                }))
              }
            />{' '}
            Показывать на киоске баннер о приостановке
          </label>
          {s && (
            <>
              <div className={styles.row}>
                <Field label="С (включительно)" type="date" {...b(['suspension', 'from'])} />
                <Field label="По (включительно)" type="date" {...b(['suspension', 'to'])} />
              </div>
              <Field label="Текст баннера" multiline {...b(['suspension', 'text'])} />
            </>
          )}
        </section>
      </DocForm>
    </>
  );
}
