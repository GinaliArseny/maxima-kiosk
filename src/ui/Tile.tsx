import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ui.module.css';

interface TileProps {
  to?: string;
  onPress?: () => void;
  icon?: ReactNode;
  accent?: boolean;
  hint?: string;
  children: ReactNode;
}

/** Крупная плитка-кнопка главного экрана. */
export function Tile({ to, onPress, icon, accent, hint, children }: TileProps) {
  const navigate = useNavigate();
  const press = () => (to ? navigate(to) : onPress?.());
  return (
    <button type="button" className={accent ? `${styles.tile} ${styles.tileAccent}` : styles.tile} onClick={press}>
      {icon && <span className={styles.tileIcon} aria-hidden="true">{icon}</span>}
      <span className={styles.tileLabel}>{children}</span>
      {hint && <span className={styles.tileHint}>{hint}</span>}
    </button>
  );
}
