import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExternalLink } from '../external/ExternalLinkProvider';
import { useIdleReset } from './useIdleReset';

export const IDLE_MS = 90_000;
/** Страница киоска живёт неделями: раз в полчаса в момент простоя перезагружаемся,
 *  чтобы подтянуть новые data/*.json, PDF и сборку (новый service worker). */
export const RELOAD_AFTER_MS = 30 * 60_000;

const defaultReload = () => window.location.reload();

/** Через 90 с без касаний — закрыть модалки и вернуться на главную; если страница старше 30 мин — перезагрузить. */
export function IdleReset({ reload = defaultReload }: { reload?: () => void }) {
  const navigate = useNavigate();
  const { close } = useExternalLink();
  const loadedAt = useRef(Date.now());
  useIdleReset(IDLE_MS, () => {
    if (Date.now() - loadedAt.current >= RELOAD_AFTER_MS) {
      loadedAt.current = Date.now();
      reload();
      return;
    }
    close();
    navigate('/', { replace: true });
  });
  return null;
}
