import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Tone } from './tone';
import styles from './ui.module.css';

/** Экран второго уровня: шапка цвета раздела с «Назад», заголовком и «Главная». */
export function ScreenLayout({ title, tone = 'graphite', children }: { title: string; tone?: Tone; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className={styles.screen} data-tone={tone}>
      <header className={styles.header}>
        <button type="button" className={styles.navButton} onClick={() => navigate(-1)}>
          <span aria-hidden="true">‹</span> Назад
        </button>
        <h1 className={styles.title}>{title}</h1>
        <button type="button" className={styles.navButton} onClick={() => navigate('/')}>
          Главная
        </button>
      </header>
      <main className={styles.body}>{children}</main>
    </div>
  );
}
