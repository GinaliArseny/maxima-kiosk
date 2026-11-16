import type { KioskData } from '../data/schema';
import { REQUIREMENTS } from './requirements';

export type CoverageStatus = 'covered' | 'missing' | 'n/a' | 'conditional';
export interface CoverageRow {
  n: number;
  title: string;
  status: CoverageStatus;
}

/** Номера пунктов, закрытых данными. PDF без файла в existingFiles ничего не закрывает. */
export function collectCoveredRefs(data: KioskData, existingFiles?: Set<string>): Set<number> {
  const refs = new Set<number>();
  const docRefs = new Set<number>();
  for (const section of data.sections)
    for (const item of section.items) {
      if (item.kind === 'pdf' && existingFiles && !existingFiles.has(item.file)) continue;
      item.legalRefs.forEach((n) => docRefs.add(n));
    }
  docRefs.forEach((n) => n !== 10 && refs.add(n));

  const c = data.clinic;
  const add = (n: number, ok: unknown) => ok && refs.add(n);
  add(1, c.legalName);
  add(2, c.addresses.length > 0);
  add(3, c.legalAddress);
  add(4, c.ogrn);
  add(5, c.inn);
  add(6, c.email);
  add(7, c.site);
  add(10, c.license.number && c.license.date && c.license.issuer && docRefs.has(10));
  add(15, data.doctors.length > 0 && data.doctors.every((d) => d.credentials.length > 0));
  add(16, data.doctors.length > 0 && data.doctors.every((d) => Object.values(d.schedule).some(Boolean)));
  add(22, c.postalAddress);
  add(23, c.chiefDoctor.phone && c.chiefDoctor.receptionHours && c.recordsRoomHours);
  add(24, data.authorities.length >= 3 && data.authorities.every((a) => a.address && a.phone));
  return refs;
}

export function computeCoverage(data: KioskData, existingFiles: Set<string>): CoverageRow[] {
  const covered = collectCoveredRefs(data, existingFiles);
  return REQUIREMENTS.map(({ n, title, stand, conditional }) => ({
    n,
    title,
    status: !stand ? 'n/a' : conditional ? 'conditional' : covered.has(n) ? 'covered' : 'missing',
  }));
}
