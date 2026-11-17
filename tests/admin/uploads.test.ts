import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../admin/server/contentStore';
import { MAX_PDF_BYTES, savePdf, savePhoto } from '../../admin/server/uploads';
import { makeContentRoot } from './helpers';

const pdf = (size = 1024) => {
  const b = Buffer.alloc(size, 0x20);
  b.write('%PDF-1.4\n');
  return b;
};
const jpg = () => sharp({ create: { width: 1200, height: 900, channels: 3, background: '#f18a1e' } }).jpeg().toBuffer();

describe('Загрузка файлов в админке', () => {
  it('PDF сохраняется под новым уникальным именем, старый прайс остаётся', async () => {
    const root = makeContentRoot();
    const before = readdirSync(join(root, 'docs'));
    const name = await savePdf(root, pdf(), 'Прейскурант', new Date('2026-11-17T10:00:00Z'));
    expect(name).toMatch(/^preiskurant-2026-11-17-[0-9a-f]{6}\.pdf$/);
    expect(existsSync(join(root, 'docs', name))).toBe(true);
    for (const f of before) expect(existsSync(join(root, 'docs', f)), f).toBe(true);
    const second = await savePdf(root, pdf(), 'Прейскурант', new Date('2026-11-17T10:00:00Z'));
    expect(second).not.toBe(name);
  });

  it('файл не PDF (без %PDF в начале) отклоняется', async () => {
    const err = await savePdf(makeContentRoot(), Buffer.from('<html>не pdf</html>'), 'x').catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).issues[0]).toMatchObject({ path: 'file' });
  });

  it('PDF больше 30 МБ отклоняется', async () => {
    expect(MAX_PDF_BYTES).toBe(30 * 1024 * 1024);
    await expect(savePdf(makeContentRoot(), pdf(MAX_PDF_BYTES + 1), 'x')).rejects.toBeInstanceOf(ValidationError);
  });

  it('фото jpg превращается в webp шириной не больше 600 px', async () => {
    const root = makeContentRoot();
    const rel = await savePhoto(root, await jpg(), 'Иванова Анна');
    expect(rel).toMatch(/^doctors\/ivanova-anna-[0-9a-f]{6}\.webp$/);
    const meta = await sharp(join(root, rel)).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(600);
  });

  it('битая картинка отклоняется понятной ошибкой', async () => {
    const err = await savePhoto(makeContentRoot(), Buffer.from('мусор'), 'x').catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).issues[0].message).toMatch(/изображ/i);
  });
});
