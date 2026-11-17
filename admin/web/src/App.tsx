import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { api, ApiAuthError } from './api';
import { AuthLostContext } from './auth';
import { AuthoritiesForm } from './pages/AuthoritiesForm';
import { ClinicForm } from './pages/ClinicForm';
import { Dashboard } from './pages/Dashboard';
import { Doctors } from './pages/Doctors';
import { Documents } from './pages/Documents';
import { Login } from './pages/Login';
import { Prices } from './pages/Prices';
import styles from './ui/admin.module.css';

const NAV: [string, string][] = [
  ['/', 'Главная'],
  ['/doctors', 'Врачи'],
  ['/documents', 'Документы'],
  ['/prices', 'Цены'],
  ['/clinic', 'Клиника'],
  ['/authorities', 'Надзорные органы'],
  ['/screensaver', 'Заставка'],
  ['/history', 'История'],
];

export default function App() {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const lost = useCallback(() => setUser(null), []);

  useEffect(() => {
    api.me().then(
      (me) => setUser(me.login),
      (e) => setUser(e instanceof ApiAuthError ? null : null),
    );
  }, []);

  if (user === undefined) return <p style={{ padding: 32 }}>Загрузка…</p>;
  if (user === null) return <Login onLogin={setUser} />;

  return (
    <AuthLostContext.Provider value={lost}>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className={styles.layout}>
          <nav className={styles.nav} aria-label="Разделы админки">
            <h1>Киоск «Максима»</h1>
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end>
                {label}
              </NavLink>
            ))}
            <div className={styles.who}>
              {user}
              <br />
              <button type="button" onClick={() => void api.logout().finally(lost)}>
                Выйти
              </button>
            </div>
          </nav>
          <main className={styles.main}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/doctors" element={<Doctors />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/prices" element={<Prices />} />
              <Route path="/clinic" element={<ClinicForm />} />
              <Route path="/authorities" element={<AuthoritiesForm />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </AuthLostContext.Provider>
  );
}
