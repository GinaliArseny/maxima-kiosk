import { useNavigate } from 'react-router-dom';
import { useKioskData } from '../data/DataProvider';
import { ScreenLayout } from '../ui/ScreenLayout';
import styles from './screens.module.css';

export const initials = (fullName: string) =>
  fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

export function Avatar({ fullName, photo, size }: { fullName: string; photo?: string; size: number }) {
  return photo ? (
    <img className={styles.avatar} src={photo} alt="" width={size} height={size} />
  ) : (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize: size / 2.6 }} aria-hidden="true">
      {initials(fullName)}
    </span>
  );
}

export function Doctors() {
  const { doctors } = useKioskData();
  const navigate = useNavigate();
  return (
    <ScreenLayout title="Врачи" tone="cyan">
      <div className={styles.doctorGrid}>
        {doctors.map((d) => (
          <button key={d.id} type="button" className={styles.doctorTile} onClick={() => navigate(`/doctors/${d.id}`)}>
            <Avatar fullName={d.fullName} photo={d.photo} size={120} />
            <span className={styles.doctorName}>{d.fullName}</span>
            <span className={styles.doctorSpec}>{d.specialty}</span>
          </button>
        ))}
      </div>
    </ScreenLayout>
  );
}
