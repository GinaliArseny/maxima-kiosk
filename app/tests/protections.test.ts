import { describe, expect, it } from 'vitest';
import { checkProtections, parseRegQuery, PROTECTION_KEYS } from '../src/protections';

const EXE = 'C:\\Program Files\\MaximaKiosk\\MaximaKiosk.exe';
/** Реестр Windows — граница ОС: отвечаем из словаря «ключ|значение». */
const registry = (over: Record<string, string | null> = {}) => {
  const base: Record<string, string | null> = {
    [`${PROTECTION_KEYS.shell.key}|Shell`]: EXE,
    [`${PROTECTION_KEYS.edgeSwipe.key}|AllowEdgeSwipe`]: '0',
    [`${PROTECTION_KEYS.taskMgr.key}|DisableTaskMgr`]: '1',
    [`${PROTECTION_KEYS.autoLogon.key}|AutoAdminLogon`]: '1',
    [`${PROTECTION_KEYS.watchdog.key}|Id`]: '{guid}',
    ...over,
  };
  return async (key: string, value: string) => base[`${key}|${value}`] ?? null;
};

describe('Самопроверка защиты Windows', () => {
  it('всё на месте — все пункты ✓', async () => {
    const res = await checkProtections(registry(), { exePath: EXE });
    expect(res.map((r) => r.name)).toEqual([
      'Киоск вместо рабочего стола',
      'Свайпы от краёв экрана выключены',
      'Диспетчер задач выключен',
      'Автовход учётки «Киоск»',
      'Сторож перезапуска',
    ]);
    expect(res.every((r) => r.ok)).toBe(true);
  });

  it('обновление Windows сбросило shell — «Киоск вместо рабочего стола» ✗', async () => {
    const res = await checkProtections(registry({ [`${PROTECTION_KEYS.shell.key}|Shell`]: 'explorer.exe' }), { exePath: EXE });
    expect(res.find((r) => r.name === 'Киоск вместо рабочего стола')!.ok).toBe(false);
    expect(res.filter((r) => !r.ok)).toHaveLength(1);
  });

  it('путь в реестре в другом регистре и в кавычках — всё равно ✓', async () => {
    const res = await checkProtections(registry({ [`${PROTECTION_KEYS.shell.key}|Shell`]: `"${EXE.toUpperCase()}"` }), { exePath: EXE });
    expect(res[0].ok).toBe(true);
  });

  it('reg query упал — пункт ✗, а не исключение', async () => {
    const res = await checkProtections(async () => {
      throw new Error('нет reg.exe');
    }, { exePath: EXE });
    expect(res.every((r) => !r.ok)).toBe(true);
  });

  it('разбор вывода reg query: строка и DWORD', () => {
    expect(parseRegQuery('\r\nHKEY_CURRENT_USER\\X\r\n    Shell    REG_SZ    C:\\Program Files\\MaximaKiosk\\MaximaKiosk.exe\r\n\r\n')).toBe(EXE);
    expect(parseRegQuery('\r\nHKEY_LOCAL_MACHINE\\Y\r\n    AllowEdgeSwipe    REG_DWORD    0x0\r\n')).toBe('0');
    expect(parseRegQuery('\r\nHKEY_CURRENT_USER\\Z\r\n    DisableTaskMgr    REG_DWORD    0x1\r\n')).toBe('1');
    expect(parseRegQuery('')).toBeNull();
  });
});
