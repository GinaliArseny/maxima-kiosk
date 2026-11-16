import styles from './ui.module.css';

/** Официальный логотип клиники (с maxima-sm.ru). */
export function Logo() {
  return <img className={styles.logo} src="brand/logo.jpg" alt="Стоматологический центр «Максима»" />;
}
