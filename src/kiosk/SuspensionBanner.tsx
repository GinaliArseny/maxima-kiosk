import type { Clinic } from '../data/schema';
import { moscowDate, useNow } from './time';
import styles from './kiosk.module.css';

/** Баннер виден, если активен и сегодня (МСК) в интервале [from; to] включительно. */
export function isSuspensionVisible(s: Clinic['suspension'], today: string): boolean {
  return !!s && s.active && s.from <= today && today <= s.to;
}

export function SuspensionBanner({ suspension }: { suspension: Clinic['suspension'] }) {
  const now = useNow();
  if (!isSuspensionVisible(suspension, moscowDate(now))) return null;
  return (
    <div className={styles.banner} role="status">
      <strong>Внимание!</strong> <span>{suspension!.text}</span>
    </div>
  );
}
