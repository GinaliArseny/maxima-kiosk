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

/** Нет файла или он битый — значения по умолчанию: киоск должен запуститься всегда. */
export function loadConfig(path: string): LocalConfig {
  try {
    return localConfigSchema.parse(JSON.parse(readFileSync(path, 'utf-8')));
  } catch {
    return localConfigSchema.parse({});
  }
}

export function saveConfig(path: string, cfg: LocalConfig): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  renameSync(tmp, path);
}
