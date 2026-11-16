import { useEffect, type ReactNode } from 'react';
import { useKioskData } from '../data/DataProvider';
import { DemoRibbon } from './DemoRibbon';
import { SuspensionBanner } from './SuspensionBanner';
import styles from './kiosk.module.css';

/** Общая рамка киоска: баннер приостановки, демо-лента, защита от контекстного меню. */
export function KioskShell({ children }: { children: ReactNode }) {
  const { clinic } = useKioskData();

  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    window.addEventListener('contextmenu', block);
    return () => window.removeEventListener('contextmenu', block);
  }, []);

  return (
    <div className={styles.shell}>
      <SuspensionBanner suspension={clinic.suspension} />
      <div className={styles.content}>{children}</div>
      {clinic.demo && <DemoRibbon />}
    </div>
  );
}
