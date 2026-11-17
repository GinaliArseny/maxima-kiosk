import { useCallback, useEffect, useState } from 'react';
import type { Clinic, DocItem, DocSection } from '../../../../src/data/schema';
import { api, ApiAuthError } from '../api';
import { useAuthLost } from '../auth';
import { FileInput } from '../ui/FileInput';
import styles from '../ui/admin.module.css';

const NEW_PRICE: DocItem = { kind: 'pdf', id: 'prices', title: 'Прейскурант на платные медицинские услуги', legalRefs: [11], file: '' };

/** Цены: один экран — загрузить новый прайс. Остальное делается само. */
export function Prices() {
  const lost = useAuthLost();
  const [current, setCurrent] = useState<{ title: string; file: string } | null | undefined>(undefined);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [{ data: clinic }, { data: sections }] = await Promise.all([
        api.getContent<Clinic>('clinic.json'),
        api.getContent<DocSection[]>('documents.json'),
      ]);
      const item = sections.flatMap((s) => s.items).find((i) => i.id === clinic.priceDocId);
      setCurrent(item?.kind === 'pdf' ? { title: item.title, file: item.file } : null);
    } catch (e) {
      if (e instanceof ApiAuthError) lost();
    }
  }, [lost]);
  useEffect(() => void load(), [load]);

  /** Новый файл → элемент прайса в documents.json; если прайса ещё нет — создаём и прописываем в clinic.json. */
  const publish = async (file: string) => {
    const [clinicDoc, docsDoc] = await Promise.all([api.getContent<Clinic>('clinic.json'), api.getContent<DocSection[]>('documents.json')]);
    const id = clinicDoc.data.priceDocId;
    const exists = id && docsDoc.data.some((s) => s.items.some((i) => i.id === id));
    if (exists) {
      const sections = docsDoc.data.map((s) => ({ ...s, items: s.items.map((i) => (i.id === id && i.kind === 'pdf' ? { ...i, file } : i)) }));
      await api.putContent('documents.json', sections, docsDoc.version);
    } else {
      const target = docsDoc.data.findIndex((s) => s.id === 'services');
      const at = target >= 0 ? target : docsDoc.data.findIndex((s) => s.screen === 'documents');
      const sections = docsDoc.data.map((s, k) => (k === at ? { ...s, items: [{ ...NEW_PRICE, file }, ...s.items] } : s));
      await api.putContent('documents.json', sections, docsDoc.version);
      await api.putContent('clinic.json', { ...clinicDoc.data, priceDocId: NEW_PRICE.id }, clinicDoc.version);
    }
    setMsg('Прайс обновлён — на киоске через 1–3 минуты');
    await load();
  };

  if (current === undefined) return <p>Загрузка…</p>;
  return (
    <>
      <h2>Цены</h2>
      <section className={styles.card}>
        {current ? (
          <p>
            Сейчас на киоске: <strong>{current.title}</strong>
            <br />
            <span className={styles.muted}>{current.file}</span>
          </p>
        ) : (
          <p className={styles.err}>Прайс на киоске не показан — загрузите PDF.</p>
        )}
        <p className={styles.muted}>Прайс должен быть утверждённым, с подписями (требование юристов, п. 11).</p>
        <FileInput label="Новый прайс (PDF)" kind="pdf" hint="prices" accept="application/pdf" doneText={() => 'Файл загружен'} onUploaded={publish} />
        {msg && <p className={styles.ok}>{msg}</p>}
      </section>
    </>
  );
}
