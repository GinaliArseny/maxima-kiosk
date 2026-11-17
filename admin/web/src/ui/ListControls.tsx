import { useState } from 'react';
import styles from './admin.module.css';

/** Кнопки строки списка: порядок, правка, удаление в два касания (без window.confirm). */
export function ListControls({
  index,
  count,
  move,
  onEdit,
  onDelete,
  children,
}: {
  index: number;
  count: number;
  move: (from: number, to: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  children?: React.ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <button type="button" className={styles.secondary} disabled={index === 0} onClick={() => move(index, index - 1)}>
        Выше
      </button>
      <button type="button" className={styles.secondary} disabled={index === count - 1} onClick={() => move(index, index + 1)}>
        Ниже
      </button>
      {children}
      <button type="button" className={styles.secondary} onClick={onEdit}>
        Изменить
      </button>
      {confirm ? (
        <button type="button" className={styles.danger} onClick={onDelete}>
          Точно удалить?
        </button>
      ) : (
        <button type="button" className={styles.danger} onClick={() => setConfirm(true)}>
          Удалить
        </button>
      )}
    </>
  );
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
