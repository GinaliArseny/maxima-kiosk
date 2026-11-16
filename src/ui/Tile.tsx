import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ui.module.css';

interface TileProps {
  to?: string;
  /** Внешний адрес — обычная ссылка в той же вкладке (только для игры). */
  href?: string;
  onPress?: () => void;
  icon?: ReactNode;
  accent?: boolean;
  hint?: string;
  children: ReactNode;
}

/** Крупная плитка-кнопка главного экрана. */
export function Tile({ to, href, onPress, icon, accent, hint, children }: TileProps) {
  const navigate = useNavigate();
  const press = () => (to ? navigate(to) : onPress?.());
  const className = accent ? `${styles.tile} ${styles.tileAccent}` : styles.tile;
  const inner = (
    <>
      {icon && <span className={styles.tileIcon} aria-hidden="true">{icon}</span>}
      <span className={styles.tileLabel}>{children}</span>
      {hint && <span className={styles.tileHint}>{hint}</span>}
    </>
  );
  if (href)
    return (
      <a className={className} href={href}>
        {inner}
      </a>
    );
  return (
    <button type="button" className={className} onClick={press}>
      {inner}
    </button>
  );
}
