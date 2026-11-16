import { useKioskData } from '../data/DataProvider';
import { ExternalLink } from '../external/ExternalLinkProvider';
import { HoursTable } from '../ui/HoursTable';
import { ScreenLayout } from '../ui/ScreenLayout';
import styles from './screens.module.css';

export function Contacts() {
  const { clinic } = useKioskData();
  return (
    <ScreenLayout title="Контакты" tone="graphite">
      <div className={styles.stack}>
        {clinic.addresses.map((a) => (
          <section key={a.address} className={styles.card}>
            <h2>{a.address}</h2>
            <HoursTable hours={a.hours} />
          </section>
        ))}
        <section className={styles.card}>
          <h2>Связь</h2>
          <dl className={styles.facts}>
            {clinic.phones.map((p) => (
              <div key={p.number}>
                <dt>{p.label}</dt>
                <dd>{p.number}</dd>
              </div>
            ))}
            <div>
              <dt>Электронная почта</dt>
              <dd>{clinic.email}</dd>
            </div>
            <div>
              <dt>Сайт</dt>
              <dd>
                <ExternalLink url={clinic.site} title="Сайт клиники" />
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </ScreenLayout>
  );
}
