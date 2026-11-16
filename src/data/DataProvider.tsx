import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadKioskData } from './load';
import type { KioskData } from './schema';

export const RETRY_MS = 30_000;

const DataContext = createContext<KioskData | null>(null);

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: KioskData };

/** Грузит данные; при ошибке показывает экран недоступности и повторяет каждые 30 с. */
export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadKioskData().then(
      (data) => !cancelled && setState({ status: 'ready', data }),
      (err) => {
        if (cancelled) return;
        console.error(err);
        setState((s) => (s.status === 'ready' ? s : { status: 'error' }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (state.status !== 'error') return;
    const t = setTimeout(() => setAttempt((a) => a + 1), RETRY_MS);
    return () => clearTimeout(t);
  }, [state, attempt]);

  if (state.status === 'loading') return <div className="fullscreen-message" aria-busy="true" />;
  if (state.status === 'error')
    return (
      <div className="fullscreen-message" role="alert">
        <h1>Информация временно недоступна</h1>
        <p>Пожалуйста, обратитесь к администратору на стойке регистрации.</p>
      </div>
    );
  return <DataContext.Provider value={state.data}>{children}</DataContext.Provider>;
}

export function useKioskData(): KioskData {
  const data = useContext(DataContext);
  if (!data) throw new Error('useKioskData вне DataProvider');
  return data;
}
