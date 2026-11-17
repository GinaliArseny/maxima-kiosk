import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

export const DEFAULT_KIOSK_URL = 'https://kiosk.339933.net/';

export const localConfigSchema = z.object({
  kioskUrl: z.string().url().default(DEFAULT_KIOSK_URL),
  /** Нет → первый запуск: сервисное меню просит задать PIN. */
  pinHash: z.string().optional(),
  /** Доступ к Jellyfin пользователем «kiosk» (не ключом API — он даёт права администратора). */
  jellyfin: z
    .object({
      internalUrl: z.string().url(),
      externalUrl: z.string().url().optional(),
      user: z.string().min(1),
      password: z.string(),
    })
    .optional(),
});
export type LocalConfig = z.infer<typeof localConfigSchema>;

/**
 * Нет файла или он битый — значения по умолчанию: киоск должен запуститься всегда.
 * Поля разбираются по отдельности: одно битое поле не сбрасывает PIN (иначе любой,
 * кто знает жест, задал бы свой).
 */
export function loadConfig(path: string): LocalConfig {
  let raw: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    if (parsed && typeof parsed === 'object') raw = parsed;
  } catch {
    /* нет файла или не JSON */
  }
  const field = <K extends keyof typeof localConfigSchema.shape>(key: K) => {
    const res = localConfigSchema.shape[key].safeParse(raw[key]);
    return res.success ? res.data : undefined;
  };
  return localConfigSchema.parse({ kioskUrl: field('kioskUrl'), pinHash: field('pinHash'), jellyfin: field('jellyfin') });
}

export function saveConfig(path: string, cfg: LocalConfig): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  renameSync(tmp, path);
}
