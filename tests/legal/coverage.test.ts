import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadKioskData } from '../../src/data/load';
import type { KioskData } from '../../src/data/schema';
import { computeCoverage } from '../../src/legal/coverage';
import { REQUIREMENTS } from '../../src/legal/requirements';
import { makeFakeFetch } from '../helpers/seed';

const seed = () => loadKioskData(makeFakeFetch());
const allFiles = new Set(readdirSync(resolve(__dirname, '../../public/docs')));
const status = (data: KioskData, n: number, files = allFiles) =>
  computeCoverage(data, files).find((r) => r.n === n)?.status;

describe('Покрытие юридических пунктов стенда', () => {
  it('в требованиях ровно 28 пунктов', () => {
    expect(REQUIREMENTS.map((r) => r.n)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
  });

  it('сид покрывает все пункты стенда', async () => {
    const missing = computeCoverage(await seed(), allFiles).filter((r) => r.status === 'missing');
    expect(missing, 'незакрытые пункты').toEqual([]);
  });

  it('пункт 26 неприменим к стенду', async () => {
    expect(status(await seed(), 26)).toBe('n/a');
  });

  it('пункт 27 условный — баннер приостановки', async () => {
    expect(status(await seed(), 27)).toBe('conditional');
  });

  it('отсутствующий PDF раскрывает дыру', async () => {
    const data = await seed();
    data.sections = data.sections.map((s) => ({
      ...s,
      items: s.items.map((i) => (i.id === 'egrul' && i.kind === 'pdf' ? { ...i, file: 'egrul-missing.pdf' } : i)),
    }));
    expect(status(data, 9)).toBe('missing');
  });

  it('врач без квалификации раскрывает п.15', async () => {
    const data = await seed();
    data.doctors[0] = { ...data.doctors[0], credentials: [] };
    expect(status(data, 15)).toBe('missing');
  });

  it('меньше трёх надзорных органов раскрывает п.24', async () => {
    const data = await seed();
    data.authorities = data.authorities.slice(0, 2);
    expect(status(data, 24)).toBe('missing');
  });

  it('лицензия без PDF не закрывает п.10', async () => {
    const data = await seed();
    data.sections = data.sections.map((s) => ({ ...s, items: s.items.filter((i) => i.id !== 'license') }));
    expect(status(data, 10)).toBe('missing');
  });
});
