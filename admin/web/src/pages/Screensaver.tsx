import { useId, useState } from 'react';
import { parseJellyfinLink } from '../../../../src/data/jellyfin';
import type { Screensaver as Settings } from '../../../../src/data/schema';
import { bindField, DocForm, Field, useDoc } from '../ui/form';
import { moveItem } from '../ui/ListControls';
import styles from '../ui/admin.module.css';

export function Screensaver() {
  const doc = useDoc<Settings>('screensaver.json');
  const { data, update } = doc;
  const [link, setLink] = useState('');
  const [linkErr, setLinkErr] = useState('');
  const ids = { on: useId(), sound: useId(), link: useId(), mins: useId() };

  return (
    <>
      <h2>Заставка</h2>
      <p className={styles.muted}>
        Когда к киоску долго никто не подходит, программа-киоск включает видео из Jellyfin по кругу. Касание экрана — снова главная.
      </p>
      <DocForm doc={doc}>
        {data && (
          <>
            <section className={styles.card}>
              <label htmlFor={ids.on}>
                <input id={ids.on} type="checkbox" checked={data.enabled} onChange={(e) => update((d) => ({ ...d, enabled: e.target.checked }))} />{' '}
                Заставка включена
              </label>
              <label htmlFor={ids.sound}>
                <input id={ids.sound} type="checkbox" checked={!data.muted} onChange={(e) => update((d) => ({ ...d, muted: !e.target.checked }))} />{' '}
                Со звуком
              </label>
              <div className={styles.field}>
                <label htmlFor={ids.mins}>Через сколько минут простоя</label>
                <input
                  id={ids.mins}
                  type="number"
                  min={1}
                  max={60}
                  value={data.idleMinutes}
                  onChange={(e) => update((d) => ({ ...d, idleMinutes: Number(e.target.value) }))}
                />
              </div>
            </section>

            <section className={styles.card}>
              <h3>Что показывать</h3>
              <ul className={styles.list} aria-label="Что показывать">
                {data.sources.map((s, i) => (
                  <li key={s.itemId + i} className={styles.listItem}>
                    <span className={styles.grow}>
                      <Field label={`Подпись ${i + 1} (для себя)`} {...bindField(data, update, 'screensaver', ['sources', i, 'label'], { optional: true })} />
                      <small className={styles.muted}>Jellyfin ID: {s.itemId}</small>
                    </span>
                    <button type="button" className={styles.secondary} disabled={i === 0} onClick={() => update((d) => ({ ...d, sources: moveItem(d.sources, i, i - 1) }))}>
                      Выше
                    </button>
                    <button type="button" className={styles.danger} onClick={() => update((d) => ({ ...d, sources: d.sources.filter((_, j) => j !== i) }))}>
                      Убрать
                    </button>
                  </li>
                ))}
              </ul>
              <div className={styles.field}>
                <label htmlFor={ids.link}>Ссылка из Jellyfin</label>
                <input id={ids.link} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…/web/#/details?id=…" />
                {linkErr && <small className={styles.fieldErr}>{linkErr}</small>}
              </div>
              <div>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => {
                    const itemId = parseJellyfinLink(link);
                    if (!itemId) return setLinkErr('Не похоже на ссылку Jellyfin — откройте видео, плейлист, папку или библиотеку в Jellyfin и скопируйте адрес из адресной строки');
                    setLinkErr('');
                    setLink('');
                    update((d) => ({ ...d, sources: [...d.sources, { itemId }] }));
                  }}
                >
                  Добавить ссылку
                </button>
              </div>
              <details>
                <summary>Как достать ссылку</summary>
                <ol>
                  <li>Откройте Jellyfin в браузере.</li>
                  <li>Откройте плейлист (лучше один плейлист «Заставка киоска»), библиотеку, папку или отдельное видео.</li>
                  <li>Скопируйте адрес из адресной строки браузера целиком и вставьте сюда. Подойдёт любой из видов: …/web/#/details?id=…, …?topParentId=… (вся библиотека), …?parentId=… (папка).</li>
                  <li>Пользователю «kiosk» в Jellyfin должен быть открыт доступ к этой библиотеке или плейлисту, иначе киоск его не увидит.</li>
                </ol>
                <p className={styles.muted}>Ссылки «Скачать» с ApiKey не нужны: ключ из ссылки всё равно не сохраняется.</p>
              </details>
            </section>
          </>
        )}
      </DocForm>
    </>
  );
}
