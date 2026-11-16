import styles from './ui.module.css';

/** Текстовый вордмарк до получения исходника логотипа от клиники. */
export function Logo() {
  return (
    <div className={styles.logo} aria-label="Максима">
      <span className={styles.logoDots} aria-hidden="true">
        <i style={{ background: 'var(--dot-1)' }} />
        <i style={{ background: 'var(--dot-2)' }} />
        <i style={{ background: 'var(--dot-3)' }} />
        <i style={{ background: 'var(--c-accent)' }} />
      </span>
      <span className={styles.logoText}>МАКСИМА</span>
    </div>
  );
}
