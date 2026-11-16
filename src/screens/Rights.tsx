import { useKioskData } from '../data/DataProvider';
import { ExternalLink } from '../external/ExternalLinkProvider';
import { ScreenLayout } from '../ui/ScreenLayout';
import { Facts } from './Facts';
import { SectionList } from './SectionList';
import styles from './screens.module.css';

export function Rights() {
  const { clinic, sections, authorities } = useKioskData();
  return (
    <ScreenLayout title="Права пациента и обращения" tone="purple">
      <div className={styles.stack}>
        <SectionList sections={sections.filter((s) => s.screen === 'rights')} />
        <section className={styles.card} aria-labelledby="sec-contacts-appeal">
          <h2 id="sec-contacts-appeal">Куда направить обращение</h2>
          <Facts
            rows={[
              ['Почтовый адрес', clinic.postalAddress],
              ['Электронная почта', clinic.email],
            ]}
          />
        </section>
        <section className={styles.card} aria-labelledby="sec-chief">
          <h2 id="sec-chief">Главный врач</h2>
          <Facts
            rows={[
              ['ФИО', clinic.chiefDoctor.fullName],
              ['Телефон', clinic.chiefDoctor.phone],
              ['График приёма', clinic.chiefDoctor.receptionHours],
              ['Ознакомление с медицинской документацией', clinic.recordsRoomHours],
            ]}
          />
        </section>
        {authorities.length > 0 && (
          <section className={styles.card} aria-labelledby="sec-authorities">
            <h2 id="sec-authorities">Органы государственного надзора</h2>
            {authorities.map((a) => (
              <div key={a.name} className={styles.authority}>
                <h3>{a.name}</h3>
                <Facts
                  rows={[
                    ['Адрес', a.address],
                    ['Телефон', a.phone],
                    ['Сайт', a.site && <ExternalLink url={a.site} title={a.name} />],
                  ]}
                />
              </div>
            ))}
          </section>
        )}
      </div>
    </ScreenLayout>
  );
}
