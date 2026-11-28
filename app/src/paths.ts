import { app } from 'electron';
import { join } from 'node:path';

/**
 * Каталог настроек: на Windows — %ProgramData%\MaximaKiosk (общий для учёток, его видит сторож),
 * в разработке на других ОС — userData. Права на запись учётке «Киоск» выдаёт install-kiosk.ps1.
 */
export function configDir(): string {
  if (process.platform === 'win32') return join(process.env.ProgramData ?? 'C:\\ProgramData', 'MaximaKiosk');
  return app.getPath('userData');
}

export const diagnosticLogDir = () => join(app.getPath('appData'), 'MaximaKiosk', 'logs');

export const configPath = () => join(configDir(), 'config.json');
/** Флаг намеренного выхода по PIN: сторож не перезапускает киоск, пока он есть. */
export const serviceExitFlag = () => join(configDir(), 'service-exit');
/** Последние удачные настройки заставки — на случай, если сервер недоступен. */
export const screensaverCachePath = () => join(configDir(), 'screensaver-cache.json');
