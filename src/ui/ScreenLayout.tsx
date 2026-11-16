import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ui.module.css';

/** Экран второго уровня: шапка с «Назад», заголовком и «Главная». */
export function ScreenLayout({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button type="button" className={styles.navButton} onClick={() => navigate(-1)}>
          <span aria-hidden="true">←</span> Назад
        </button>
        <h1 className={styles.title}>{title}</h1>
        <button type="button" className={styles.navButton} onClick={() => navigate('/')}>
          <span aria-hidden="true">⌂</span> Главная
        </button>
      </header>
      <main className={styles.body}>{children}</main>
    </div>
  );
}
