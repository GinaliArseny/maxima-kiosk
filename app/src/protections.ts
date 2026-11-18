import { execFile } from 'node:child_process';

/** Ключи реестра, которые ставит install-kiosk.ps1 (программа работает под учёткой «Киоск» → HKCU — её ветка). */
export const PROTECTION_KEYS = {
  shell: { key: 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon', value: 'Shell' },
  edgeSwipe: { key: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\EdgeUI', value: 'AllowEdgeSwipe' },
  taskMgr: { key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System', value: 'DisableTaskMgr' },
  autoLogon: { key: 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon', value: 'AutoAdminLogon' },
  watchdog: { key: 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Schedule\\TaskCache\\Tree\\MaximaKioskWatchdog', value: 'Id' },
} as const;

export type RegQuery = (key: string, value: string) => Promise<string | null>;

const norm = (p: string) => p.replace(/^"|"$/g, '').trim().toLowerCase();

/** Программа стоит вместо рабочего стола у текущей учётки (Shell в HKCU указывает на наш exe). */
export async function isKioskShell(reg: RegQuery, exePath: string): Promise<boolean> {
  const shell = await reg(PROTECTION_KEYS.shell.key, PROTECTION_KEYS.shell.value);
  return shell !== null && norm(shell) === norm(exePath);
}

/** Какие защиты Windows сейчас действуют. Ошибка чтения — пункт ✗, а не падение. */
export async function checkProtections(
  reg: RegQuery,
  opts: { exePath: string; taskExists?: () => Promise<boolean> },
): Promise<{ name: string; ok: boolean }[]> {
  const read = async (k: { key: string; value: string }) => {
    try {
      return await reg(k.key, k.value);
    } catch {
      return null;
    }
  };
  const K = PROTECTION_KEYS;
  return [
    { name: 'Киоск вместо рабочего стола', ok: await isKioskShell(reg, opts.exePath).catch(() => false) },
    { name: 'Свайпы от краёв экрана выключены', ok: (await read(K.edgeSwipe)) === '0' },
    { name: 'Диспетчер задач выключен', ok: (await read(K.taskMgr)) === '1' },
    { name: 'Автовход учётки «Киоск»', ok: (await read(K.autoLogon)) === '1' },
    // Ветка TaskCache может быть закрыта для обычной учётки — тогда спрашиваем планировщик.
    { name: 'Сторож перезапуска', ok: Boolean(await read(K.watchdog)) || Boolean(await opts.taskExists?.().catch(() => false)) },
  ];
}

/** Значение из вывода `reg query <ключ> /v <имя>`; DWORD 0x1 → '1'. */
export function parseRegQuery(out: string): string | null {
  const line = out.split(/\r?\n/).find((l) => /\sREG_\w+\s/.test(l));
  if (!line) return null;
  const m = /\s(REG_\w+)\s+(.*)$/.exec(line.trim());
  if (!m) return null;
  const [, type, raw] = m;
  return type === 'REG_DWORD' ? String(parseInt(raw, 16)) : raw.trim();
}

/** Настоящий reg.exe (только Windows). Нет ключа → null. */
export const winRegQuery: RegQuery = (key, value) =>
  new Promise((resolve) =>
    execFile('reg', ['query', key, '/v', value], { windowsHide: true }, (err, stdout) => resolve(err ? null : parseRegQuery(stdout))),
  );

/** Есть ли задача сторожа в планировщике (только Windows). */
export const winTaskExists = (): Promise<boolean> =>
  new Promise((resolve) =>
    execFile('schtasks', ['/query', '/tn', 'MaximaKioskWatchdog'], { windowsHide: true }, (err) => resolve(!err)),
  );
