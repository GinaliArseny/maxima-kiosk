import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Tone } from './tone';
import styles from './ui.module.css';

interface TileProps {
  to?: string;
  /** Внешний адрес — обычная ссылка в той же вкладке (только для игры). */
  href?: string;
  onPress?: () => void;
  icon?: ReactNode;
  tone?: Tone;
  /** Крупный «космический» баннер на всю ширину — для игры. */
  game?: boolean;
  hint?: string;
  children: ReactNode;
}

/** Крупная плитка-кнопка главного экрана, залитая цветом раздела. */
export function Tile({ to, href, onPress, icon, tone = 'graphite', game, hint, children }: TileProps) {
  const navigate = useNavigate();
  const press = () => (to ? navigate(to) : onPress?.());
  const className = [styles.tile, game && styles.tileGame].filter(Boolean).join(' ');
  const inner = (
    <>
      {icon && <span className={styles.tileIcon}>{icon}</span>}
      <span className={styles.tileText}>
        <span className={styles.tileLabel}>{children}</span>
        {hint && <span className={styles.tileHint}>{hint}</span>}
      </span>
    </>
  );
  if (href)
    return (
      <a className={className} href={href} data-tone={tone}>
        {inner}
      </a>
    );
  return (
    <button type="button" className={className} onClick={press} data-tone={tone}>
      {inner}
    </button>
  );
}
