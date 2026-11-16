import { WEEKDAYS, type Weekday } from '../data/schema';
import { WEEKDAY_LABELS } from '../kiosk/time';
import styles from './ui.module.css';

/** Таблица режима по дням недели; пустой день — «выходной». */
export function HoursTable({ hours }: { hours: Partial<Record<Weekday, string | null>> }) {
  return (
    <table className={styles.hoursTable}>
      <tbody>
        {WEEKDAYS.map((d) => (
          <tr key={d}>
            <th scope="row">{WEEKDAY_LABELS[d]}</th>
            <td className={hours[d] ? undefined : styles.hoursOff}>{hours[d] ?? 'выходной'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
