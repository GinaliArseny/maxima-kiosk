import { useId, useState } from 'react';
import { api } from '../api';
import styles from '../ui/admin.module.css';

export function Login({ onLogin }: { onLogin: (login: string) => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const id = useId();
  return (
    <form
      className={styles.login}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await api.login(login.trim(), password);
          onLogin(login.trim());
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Админка киоска</h2>
      <div className={styles.field}>
        <label htmlFor={`${id}-l`}>Логин</label>
        <input id={`${id}-l`} autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} />
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-p`}>Пароль</label>
        <input id={`${id}-p`} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className={styles.err} role="alert">{error}</p>}
      <button type="submit" className={styles.primary} disabled={busy}>
        Войти
      </button>
    </form>
  );
}
