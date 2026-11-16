import { useKioskData } from '../data/DataProvider';
import { moscowWeekday, useNow } from '../kiosk/time';
import { Logo } from '../ui/Logo';
import { Tile } from '../ui/Tile';
import styles from './screens.module.css';

export function Home() {
  const { clinic } = useKioskData();
  const now = useNow();
  const today = clinic.addresses[0].hours[moscowWeekday(now)];

  return (
    <main className={styles.home}>
      <header className={styles.homeHeader}>
        <Logo />
        <p className={styles.today}>{today ? `Сегодня: ${today}` : 'Сегодня выходной'}</p>
      </header>
      <section className={styles.welcome}>
        <h1>Добро пожаловать</h1>
        <p>{clinic.shortName}</p>
        <p className={styles.welcomeHint}>Коснитесь раздела, чтобы открыть его</p>
      </section>
      <nav className={styles.tiles} aria-label="Разделы">
        <Tile to="/documents" icon="📄" hint="Лицензия, реквизиты, договоры, законы">
          Документы и сведения
        </Tile>
        <Tile to="/doctors" icon="🩺" hint="Квалификация и график приёма">
          Врачи и расписание
        </Tile>
        {clinic.priceDocId && (
          <Tile to={`/doc/${clinic.priceDocId}`} icon="₽" hint="Перечень платных услуг">
            Цены
          </Tile>
        )}
        <Tile to="/rights" icon="⚖️" hint="Жалобы, главный врач, надзорные органы">
          Права пациента и обращения
        </Tile>
        <Tile to="/contacts" icon="📍" hint="Адрес, телефоны, режим работы">
          Контакты
        </Tile>
        {clinic.gameUrl && (
          <Tile href={clinic.gameUrl} icon="🚀" accent hint="Спаси зубик — получи подарок">
            Игра для детей
          </Tile>
        )}
      </nav>
    </main>
  );
}
