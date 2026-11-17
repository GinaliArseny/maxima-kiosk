import type { Authority } from '../../../../src/data/schema';
import { bindField, DocForm, Field, useDoc } from '../ui/form';
import styles from '../ui/admin.module.css';

export function AuthoritiesForm() {
  const doc = useDoc<Authority[]>('authorities.json');
  const { data, update } = doc;
  return (
    <>
      <h2>Надзорные органы</h2>
      <p className={styles.muted}>Показываются на экране «Права пациента». Для требований юристов нужны адрес и телефон каждого органа.</p>
      <DocForm doc={doc}>
        {data?.map((_, i) => {
          const b = (path: (string | number)[], optional = false) => bindField(data, update, 'authorities', [i, ...path], { optional });
          return (
            <section key={i} className={styles.card}>
              <Field label={`Орган ${i + 1}: название`} {...b(['name'])} />
              <div className={styles.row}>
                <Field label={`Орган ${i + 1}: телефон`} {...b(['phone'])} />
                <Field label={`Орган ${i + 1}: сайт`} {...b(['site'], true)} placeholder="https://…" />
              </div>
              <Field label={`Орган ${i + 1}: адрес`} {...b(['address'], true)} />
              <div>
                <button type="button" className={styles.danger} onClick={() => update((d) => d.filter((_, j) => j !== i))}>
                  Удалить орган
                </button>
              </div>
            </section>
          );
        })}
        <div>
          <button type="button" className={styles.secondary} onClick={() => update((d) => [...d, { name: '', phone: '' }])}>
            Добавить орган
          </button>
        </div>
      </DocForm>
    </>
  );
}
