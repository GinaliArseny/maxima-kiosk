import { describe, expect, it } from 'vitest';
import { DataError, loadKioskData } from '../../src/data/load';
import { makeFakeFetch, readSeed } from '../helpers/seed';

describe('loadKioskData', () => {
  it('загружает и валидирует сид', async () => {
    const data = await loadKioskData(makeFakeFetch());
    expect(data.clinic.inn, 'ИНН клиники из clinic.json').toBe('6730004954');
    expect(data.sections.length, 'секции документов загружены').toBeGreaterThan(0);
    expect(data.doctors.length).toBeGreaterThan(0);
    expect(data.authorities.length).toBeGreaterThan(0);
  });

  it('сообщает, какой файл битый', async () => {
    const doctors = (readSeed()['doctors.json'] as Record<string, unknown>[]).map(({ fullName: _, ...rest }) => rest);
    const err = await loadKioskData(makeFakeFetch({ files: { 'doctors.json': doctors } })).catch((e) => e);
    expect(err, 'ошибка валидации — DataError').toBeInstanceOf(DataError);
    expect(err.file).toBe('doctors.json');
  });

  it('сообщает о сетевой ошибке', async () => {
    const err = await loadKioskData(makeFakeFetch({ failFiles: ['clinic.json'] })).catch((e) => e);
    expect(err).toBeInstanceOf(DataError);
    expect(err.file).toBe('clinic.json');
  });
});
