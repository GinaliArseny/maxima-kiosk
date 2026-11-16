import type { DocSection } from '../data/schema';
import { DocItemView } from './DocItemView';
import styles from './screens.module.css';

export function SectionList({ sections }: { sections: DocSection[] }) {
  return (
    <>
      {sections
        .filter((s) => s.items.length > 0)
        .map((s) => (
          <section key={s.id} className={styles.card} aria-labelledby={`sec-${s.id}`}>
            <h2 id={`sec-${s.id}`}>{s.title}</h2>
            <div className={styles.docList}>
              {s.items.map((i) => (
                <DocItemView key={i.id} item={i} />
              ))}
            </div>
          </section>
        ))}
    </>
  );
}
