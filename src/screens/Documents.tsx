import { useKioskData } from '../data/DataProvider';
import { ExternalLink } from '../external/ExternalLinkProvider';
import { ScreenLayout } from '../ui/ScreenLayout';
import { Facts } from './Facts';
import { SectionList } from './SectionList';
import styles from './screens.module.css';

export function Documents() {
  const { clinic, sections } = useKioskData();
  const l = clinic.license;
  return (
    <ScreenLayout title="Документы и сведения" tone="orange">
      <div className={styles.stack}>
        <section className={styles.card} aria-labelledby="sec-requisites">
          <h2 id="sec-requisites">Реквизиты</h2>
          <Facts
            rows={[
              ['Наименование', clinic.legalName],
              ['Юридический адрес', clinic.legalAddress],
              ...clinic.addresses.map((a, i): [string, string] => [clinic.addresses.length > 1 ? `Адрес деятельности ${i + 1}` : 'Адрес деятельности', a.address]),
              ['ОГРН', clinic.ogrn],
              ['ИНН', clinic.inn],
              ['КПП', clinic.kpp],
              ['Лицензия', [`№ ${l.number} от ${l.date}`, l.validity].filter(Boolean).join(', ')],
              ['Выдана', l.issuer],
              ['Электронная почта', clinic.email],
              ['Сайт', <ExternalLink url={clinic.site} title="Сайт клиники" />],
            ]}
          />
        </section>
        <SectionList sections={sections.filter((s) => s.screen === 'documents')} />
      </div>
    </ScreenLayout>
  );
}
