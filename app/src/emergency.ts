/** Аварийная комбинация: работает из любого окна программы, в том числе поверх заставки. */
export const EMERGENCY_ACCELERATOR = 'Control+Alt+Shift+Q';

export interface EmergencyExitDeps {
  /** Программа стоит вместо рабочего стола (install-kiosk.ps1 отработал). */
  isKioskShell: () => Promise<boolean>;
  quit: () => void;
  askPin: () => void;
}

/**
 * Обычный компьютер — выход сразу: проверять программу не страшно.
 * Киоск — только окно PIN: иначе посетитель с USB-клавиатурой закроет стенд.
 */
export function createEmergencyExit(d: EmergencyExitDeps): () => Promise<void> {
  return async () => {
    // Не поняли — считаем киоском: через окно PIN выйти тоже можно.
    const kiosk = await d.isKioskShell().catch(() => true);
    if (kiosk) d.askPin();
    else d.quit();
  };
}
