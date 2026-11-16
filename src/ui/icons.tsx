/** Иконки разделов: простые линейные, белые на цветных плитках. */
const base = { width: 72, height: 72, viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const IconDocs = () => (
  <svg {...base}>
    <path d="M14 6h14l10 10v24a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
    <path d="M28 6v10h10M18 25h12M18 31h12M18 19h5" />
  </svg>
);
export const IconDoctor = () => (
  <svg {...base}>
    <circle cx="24" cy="14" r="7" />
    <path d="M10 42c0-8 6-14 14-14s14 6 14 14" />
    <path d="M24 30v6M21 33h6" />
  </svg>
);
export const IconPrice = () => (
  <svg {...base}>
    <path d="M6 24 24 6h16v16L22 40a3 3 0 0 1-4 0L6 28a3 3 0 0 1 0-4Z" />
    <circle cx="32" cy="15" r="3" />
    <path d="M20 31v-11h5a3.5 3.5 0 0 1 0 7h-7M18 29h6" />
  </svg>
);
export const IconRights = () => (
  <svg {...base}>
    <path d="M24 6 38 11v11c0 9-6 16-14 20-8-4-14-11-14-20V11Z" />
    <path d="m18 24 4 4 8-9" />
  </svg>
);
export const IconPin = () => (
  <svg {...base}>
    <path d="M24 43s-13-12-13-23a13 13 0 0 1 26 0c0 11-13 23-13 23Z" />
    <circle cx="24" cy="20" r="5" />
  </svg>
);
/** Зубик для баннера игры — заливка, не контур. */
export const IconTooth = () => (
  <svg width="140" height="140" viewBox="0 0 48 48" aria-hidden="true">
    <path
      d="M15 6c-6 0-9 5-9 11 0 5 2 8 3 13 1 6 2 12 5 12 3 0 3-6 4-10 1-3 2-5 6-5s5 2 6 5c1 4 1 10 4 10 3 0 4-6 5-12 1-5 3-8 3-13 0-6-3-11-9-11-4 0-6 2-9 2s-5-2-9-2Z"
      fill="#fff"
    />
    <circle cx="18" cy="18" r="2" fill="#1d2a8a" />
    <circle cx="30" cy="18" r="2" fill="#1d2a8a" />
    <path d="M19 24c2 2.5 8 2.5 10 0" stroke="#1d2a8a" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);
export const IconDocSmall = () => (
  <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 6h14l10 10v24a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
    <path d="M28 6v10h10M18 25h12M18 31h12" />
  </svg>
);
