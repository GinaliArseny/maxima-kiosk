import { describe, expect, it } from 'vitest';
import { createEmergencyExit } from '../src/emergency';

const run = async (isKioskShell: () => Promise<boolean>) => {
  const calls: string[] = [];
  const exit = createEmergencyExit({ isKioskShell, quit: () => calls.push('quit'), askPin: () => calls.push('pin') });
  await exit();
  return calls;
};

describe('Аварийная комбинация клавиш', () => {
  it('на обычном компьютере (киоск не вместо рабочего стола) закрывает программу сразу, без PIN', async () => {
    expect(await run(async () => false), 'на тестовом ПК выход должен быть мгновенным').toEqual(['quit']);
  });

  it('на киоске открывает окно PIN, а не закрывает стенд', async () => {
    expect(await run(async () => true), 'посетитель с клавиатурой не должен закрыть киоск').toEqual(['pin']);
  });

  it('не удалось понять, киоск ли это, — окно PIN: через него тоже можно выйти', async () => {
    const calls = await run(async () => {
      throw new Error('реестр недоступен');
    });
    expect(calls, 'сбой проверки не должен ни закрывать стенд, ни глушить комбинацию').toEqual(['pin']);
  });
});
