import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConflictError, ContentStore, ValidationError } from '../../admin/server/contentStore';
import type { Clinic, DocSection, Doctor } from '../../src/data/schema';
import { makeContentRoot, readJson } from './helpers';

const setup = (opts?: ConstructorParameters<typeof ContentStore>[1]) => {
  const root = makeContentRoot();
  return { root, store: new ContentStore(root, opts) };
};

describe('Хранилище контента админки', () => {
  it('сохранение валидных врачей видно при следующем чтении и меняет version.json', async () => {
    const { root, store } = setup();
    const { data, version } = await store.read('doctors.json');
    const doctors = data as Doctor[];
    doctors[0] = { ...doctors[0], specialty: 'Стоматология общей практики' };
    const saved = await store.save('doctors.json', doctors, version, 'admin');
    expect(saved.version).not.toBe(version);
    const again = await store.read('doctors.json');
    expect((again.data as Doctor[])[0].specialty).toBe('Стоматология общей практики');
    expect(again.version).toBe(saved.version);
    expect(readJson<{ version: string }>(root, 'version.json').version).toBeTruthy();
  });

  it('невалидные данные отклоняются с путём и русским сообщением, файл на диске не меняется', async () => {
    const { root, store } = setup();
    const before = readFileSync(join(root, 'data/doctors.json'), 'utf-8');
    const { data, version } = await store.read('doctors.json');
    const doctors = data as Doctor[];
    doctors[2] = { ...doctors[2], fullName: '' };
    const err = await store.save('doctors.json', doctors, version, 'admin').catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    const issue = (err as ValidationError).issues.find((i) => i.path === 'doctors.2.fullName');
    expect(issue, JSON.stringify((err as ValidationError).issues)).toBeDefined();
    expect(issue!.message).toMatch(/[а-я]/i);
    expect(readFileSync(join(root, 'data/doctors.json'), 'utf-8')).toBe(before);
  });

  it('конфликт версий: сохранение со старой версией отклоняется', async () => {
    const { store } = setup();
    const { data, version } = await store.read('doctors.json');
    await store.save('doctors.json', data, version, 'admin');
    await expect(store.save('doctors.json', data, version, 'owner')).rejects.toBeInstanceOf(ConflictError);
  });

  it('удаление элемента прайса, на который ссылается clinic.priceDocId, отклоняется', async () => {
    const { root, store } = setup();
    const priceId = readJson<Clinic>(root, 'clinic.json').priceDocId!;
    const { data, version } = await store.read('documents.json');
    const sections = (data as DocSection[]).map((s) => ({ ...s, items: s.items.filter((i) => i.id !== priceId) }));
    const err = await store.save('documents.json', sections, version, 'admin').catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).issues.some((i) => i.path === 'clinic.priceDocId')).toBe(true);
  });

  it('PDF-элемент с файлом, которого нет в docs/, отклоняется', async () => {
    const { store } = setup();
    const { data, version } = await store.read('documents.json');
    const sections = data as DocSection[];
    sections[0].items.push({ kind: 'pdf', id: 'ustav', title: 'Устав', legalRefs: [21], file: 'net-takogo.pdf' });
    const err = await store.save('documents.json', sections, version, 'admin').catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).issues.some((i) => /net-takogo\.pdf/.test(i.message))).toBe(true);
  });

  it('каждое сохранение попадает в историю, откат возвращает прежние данные и тоже пишется в историю', async () => {
    const { store } = setup();
    const first = await store.read('clinic.json');
    await store.save('clinic.json', { ...(first.data as Clinic), email: 'new@339933.net' }, first.version, 'admin');
    const [entry] = await store.history();
    expect(entry).toMatchObject({ user: 'admin', file: 'clinic.json' });
    expect(entry.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const second = await store.read('clinic.json');
    await store.save('clinic.json', { ...(second.data as Clinic), email: 'third@339933.net' }, second.version, 'owner');
    await store.restore(entry.id, 'owner');
    expect(((await store.read('clinic.json')).data as Clinic).email).toBe('new@339933.net');
    const history = await store.history();
    expect(history).toHaveLength(3);
    expect(history[0].user).toBe('owner');
  });

  it('история не растёт больше лимита', async () => {
    const { store } = setup({ historyLimit: 3 });
    for (let i = 0; i < 5; i++) {
      const { data, version } = await store.read('authorities.json');
      await store.save('authorities.json', data, version, `u${i}`);
    }
    expect(await store.history()).toHaveLength(3);
  });

  it('покрытие: по боевым данным открыты те же пункты, что показывает check-content', async () => {
    const { store } = setup();
    const missing = (await store.coverage()).filter((r) => r.status === 'missing').map((r) => r.n);
    expect(missing).toEqual([10, 16, 17, 21, 22, 23, 24]);
  });
});
