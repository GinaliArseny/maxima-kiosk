import { randomBytes } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { ValidationError } from './validate';

export const MAX_PDF_BYTES = 30 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_WIDTH = 600;

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'iu', я: 'ia',
};

/** Транслит + kebab-case: «Иванова Анна» → 'ivanova-anna'. Пустой результат → 'file'. */
export function slug(text: string): string {
  const latin = [...text.toLowerCase()].map((c) => TRANSLIT[c] ?? c).join('');
  return latin.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
}

const suffix = () => randomBytes(3).toString('hex');
const fail = (message: string): never => {
  throw new ValidationError([{ path: 'file', message }]);
};

async function put(dir: string, name: string, buf: Buffer) {
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, `.${name}.tmp`);
  await writeFile(tmp, buf);
  await rename(tmp, join(dir, name));
}

/** Сохраняет PDF в docs/ под новым уникальным именем; старые файлы не трогает (на них ссылается история). */
export async function savePdf(root: string, buf: Buffer, hint: string, now = new Date()): Promise<string> {
  if (buf.length > MAX_PDF_BYTES) fail('PDF больше 30 МБ — уменьшите файл');
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') fail('Это не PDF-файл');
  const name = `${slug(hint)}-${now.toISOString().slice(0, 10)}-${suffix()}.pdf`;
  await put(join(root, 'docs'), name, buf);
  return name;
}

/** Фото врача: jpg/png/webp → webp шириной 600 px в doctors/. Возвращает путь вида 'doctors/<имя>.webp'. */
export async function savePhoto(root: string, buf: Buffer, hint: string): Promise<string> {
  if (buf.length > MAX_PHOTO_BYTES) fail('Фото больше 10 МБ — уменьшите файл');
  let webp: Buffer;
  try {
    webp = await sharp(buf).rotate().resize({ width: PHOTO_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch {
    return fail('Не удалось прочитать изображение — нужен JPG или PNG');
  }
  const name = `${slug(hint)}-${suffix()}.webp`;
  await put(join(root, 'doctors'), name, webp);
  return `doctors/${name}`;
}
