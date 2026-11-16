import { useKioskData } from '../data/DataProvider';
import { moscowWeekday, useNow } from '../kiosk/time';
import { DotFlower } from '../ui/DotFlower';
import { IconDocs, IconDoctor, IconPin, IconPrice, IconRights, IconTooth } from '../ui/icons';
import { Logo } from '../ui/Logo';
import { Tile } from '../ui/Tile';
import styles from './screens.module.css';

export function Home() {
  const { clinic } = useKioskData();
  const now = useNow();
  const today = clinic.addresses[0].hours[moscowWeekday(now)];

  return (
    <main className={styles.home}>
      <DotFlower className={styles.flower} />
      <header className={styles.homeHeader}>
        <Logo />
        <p className={today ? styles.today : `${styles.today} ${styles.todayOff}`}>
          {today ? `Сегодня открыто ${today}` : 'Сегодня выходной'}
        </p>
      </header>
      <section className={styles.welcome}>
        <h1>Добро пожаловать!</h1>
        <p>Здесь документы клиники, врачи и цены. Нажмите на нужный раздел.</p>
      </section>
      <nav className={styles.tiles} aria-label="Разделы">
        {clinic.gameUrl && (
          <Tile href={clinic.gameUrl} icon={<IconTooth />} game hint="Защити зубик от кариеса — победителю подарок!">
            Игра для детей
          </Tile>
        )}
        <Tile to="/documents" tone="orange" icon={<IconDocs />} hint="Лицензия, реквизиты, законы">
          Документы и сведения
        </Tile>
        <Tile to="/doctors" tone="cyan" icon={<IconDoctor />} hint="Образование и квалификация">
          Врачи
        </Tile>
        {clinic.priceDocId && (
          <Tile to={`/doc/${clinic.priceDocId}`} tone="lime" icon={<IconPrice />} hint="Прейскурант клиники">
            Цены
          </Tile>
        )}
        <Tile to="/rights" tone="purple" icon={<IconRights />} hint="Жалобы, главный врач, надзор">
          Права пациента
        </Tile>
        <Tile to="/contacts" tone="graphite" icon={<IconPin />} hint="Адрес, телефон, режим работы">
          Контакты
        </Tile>
      </nav>
    </main>
  );
}
