import { useNavigate } from 'react-router-dom';
import { useExternalLink } from '../external/ExternalLinkProvider';
import { useIdleReset } from './useIdleReset';

export const IDLE_MS = 90_000;

/** Через 90 с без касаний — закрыть модалки и вернуться на главную. */
export function IdleReset() {
  const navigate = useNavigate();
  const { close } = useExternalLink();
  useIdleReset(IDLE_MS, () => {
    close();
    navigate('/', { replace: true });
  });
  return null;
}
