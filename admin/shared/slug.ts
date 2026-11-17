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

/** slug, не совпадающий с занятыми: 'ivanova', 'ivanova-2', … */
export function uniqueSlug(text: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slug(text);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}
