import type { ZodIssue } from 'zod';
import { EDITABLE_FILES, type Clinic, type DocSection, type Doctor, type EditableFile } from '../../src/data/schema';

export interface Issue {
  /** Путь вида 'doctors.3.fullName' — первый сегмент по имени файла. */
  path: string;
  message: string;
}

export class ValidationError extends Error {
  constructor(public readonly issues: Issue[]) {
    super(issues.map((i) => `${i.path}: ${i.message}`).join('; '));
    this.name = 'ValidationError';
  }
}

const stem = (file: EditableFile) => file.replace(/\.json$/, '');

/** Сообщения zod по-русски — их читает админ клиники. */
function russian(issue: ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined' || issue.received === 'null' ? 'Обязательное поле' : 'Неверный тип значения';
    case 'too_small':
      if (issue.type === 'string') return 'Обязательное поле';
      if (issue.type === 'array') return `Нужно хотя бы ${issue.minimum}`;
      return `Не меньше ${issue.minimum}`;
    case 'too_big':
      return issue.type === 'number' ? `Не больше ${issue.maximum}` : 'Слишком длинно';
    case 'invalid_string':
      if (issue.validation === 'url') return 'Нужна ссылка вида https://…';
      return 'Неверный формат';
    case 'invalid_enum_value':
    case 'invalid_literal':
    case 'invalid_union_discriminator':
      return 'Недопустимое значение';
    default:
      return 'Неверное значение';
  }
}

/**
 * Проверка полного набора файлов админки: схемы + связи между файлами
 * (PDF и фото на месте, ссылки clinic → документы, уникальные id).
 */
export function validateAll(
  files: Record<EditableFile, unknown>,
  existing: { docs: Set<string>; photos: Set<string> },
): Issue[] {
  const issues: Issue[] = [];
  for (const file of Object.keys(EDITABLE_FILES) as EditableFile[]) {
    const res = EDITABLE_FILES[file].safeParse(files[file]);
    if (!res.success)
      for (const i of res.error.issues) issues.push({ path: [stem(file), ...i.path].join('.'), message: russian(i) });
  }
  if (issues.length) return issues;

  const clinic = files['clinic.json'] as Clinic;
  const doctors = files['doctors.json'] as Doctor[];
  const sections = files['documents.json'] as DocSection[];

  const docIds = new Set<string>();
  sections.forEach((s, si) =>
    s.items.forEach((item, ii) => {
      const at = `documents.${si}.items.${ii}`;
      if (docIds.has(item.id)) issues.push({ path: `${at}.id`, message: `Повторяется id «${item.id}»` });
      docIds.add(item.id);
      if (item.kind === 'pdf' && !existing.docs.has(item.file))
        issues.push({ path: `${at}.file`, message: `Файл ${item.file} не найден среди загруженных документов` });
    }),
  );
  for (const [key, id] of [
    ['clinic.priceDocId', clinic.priceDocId],
    ['clinic.license.docId', clinic.license.docId],
  ] as const)
    if (id && !docIds.has(id)) issues.push({ path: key, message: `Документ «${id}» не найден в разделе «Документы»` });

  const doctorIds = new Set<string>();
  doctors.forEach((d, i) => {
    if (doctorIds.has(d.id)) issues.push({ path: `doctors.${i}.id`, message: `Повторяется id «${d.id}»` });
    doctorIds.add(d.id);
    if (d.photo && !existing.photos.has(d.photo)) issues.push({ path: `doctors.${i}.photo`, message: `Фото ${d.photo} не найдено` });
  });
  return issues;
}
