import { app } from 'electron';
import { join } from 'node:path';

/** Настройки тестовой установки принадлежат текущему пользователю Windows.
 * Не требуют install-kiosk.ps1 и не затрагивают старый ProgramData/MaximaKiosk.
 */
export function configDir(): string {
  return app.getPath('userData');
}

export const configPath = () => join(configDir(), 'config.json');
/** Флаг намеренного выхода по PIN: сторож не перезапускает киоск, пока он есть. */
export const serviceExitFlag = () => join(configDir(), 'service-exit');
/** Последние удачные настройки заставки — на случай, если сервер недоступен. */
export const screensaverCachePath = () => join(configDir(), 'screensaver-cache.json');
