import { Navigate, useParams } from 'react-router-dom';
import { useKioskData } from '../data/DataProvider';
import { WEEKDAYS, type Credential } from '../data/schema';
import { WEEKDAY_LABELS } from '../kiosk/time';
import { ScreenLayout } from '../ui/ScreenLayout';
import { Avatar } from './Doctors';
import styles from './screens.module.css';

/** Разобранные поля документа одной строкой; пустые части пропускаются. */
function credentialSummary(c: Credential) {
  return (
    [
      [c.series && `серия ${c.series}`, c.number && `№ ${c.number}`, c.uniqueNumber && `уникальный № ${c.uniqueNumber}`].filter(Boolean).join(' '),
      c.issuedAt && `от ${c.issuedAt}`,
      c.institution,
      c.specialization && `«${c.specialization}»`,
      c.validUntil && `действует до ${c.validUntil}`,
    ]
      .filter(Boolean)
      .join(', ') || '—'
  );
}

export function DoctorCard() {
  const { id } = useParams();
  const doctor = useKioskData().doctors.find((d) => d.id === id);
  if (!doctor) return <Navigate to="/doctors" replace />;
  const workDays = WEEKDAYS.filter((d) => doctor.schedule[d]);

  return (
    <ScreenLayout title={doctor.fullName} tone="cyan">
      <div className={styles.stack}>
        <section className={`${styles.card} ${styles.doctorHead}`}>
          <Avatar fullName={doctor.fullName} photo={doctor.photo} size={180} />
          <div>
            <h2>{doctor.fullName}</h2>
            <p className={styles.doctorSpec}>{doctor.specialty}</p>
          </div>
        </section>

        {workDays.length > 0 && (
          <section className={styles.card}>
            <h2 id="schedule">График приёма</h2>
            <table className={styles.table} aria-labelledby="schedule">
              <tbody>
                {workDays.map((d) => (
                  <tr key={d}>
                    <th scope="row">{WEEKDAY_LABELS[d]}</th>
                    <td>{doctor.schedule[d]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {doctor.credentials.length > 0 && (
          <section className={styles.card}>
            <h2 id="quals">Образование и квалификация</h2>
            <div className={styles.tableScroll}>
              <table className={styles.table} aria-labelledby="quals">
                <thead>
                  <tr>
                    <th scope="col">Документ</th>
                    <th scope="col">Сведения</th>
                  </tr>
                </thead>
                <tbody>
                  {doctor.credentials.map((c, i) => (
                    <tr key={i}>
                      <th scope="row" className={styles.credKind}>{c.kind}</th>
                      <td>{c.details ?? credentialSummary(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </ScreenLayout>
  );
}
