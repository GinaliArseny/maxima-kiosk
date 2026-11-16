/**
 * «Цветок» из точек — мотив логотипа: четыре лепестка цветов бренда,
 * точки мельчают к краю. Чистый декор.
 */
const PETALS = ['var(--brand-lime)', 'var(--brand-orange)', 'var(--brand-cyan)', 'var(--brand-purple)'];

function dots() {
  const out: { x: number; y: number; r: number; c: string }[] = [];
  PETALS.forEach((c, q) => {
    const base = -45 + q * 90; // направление лепестка
    for (let ring = 0; ring < 6; ring++) {
      const dist = 34 + ring * 22;
      const spread = 34 - ring * 2; // градусы раскрытия лепестка
      const n = 2 + Math.round(ring * 0.9);
      for (let i = 0; i < n; i++) {
        const a = ((base - spread / 2 + (spread * i) / Math.max(1, n - 1)) * Math.PI) / 180;
        out.push({ x: Math.cos(a) * dist, y: Math.sin(a) * dist, r: 9 - ring * 1.05, c });
      }
    }
  });
  return out;
}
const DOTS = dots();

export function DotFlower({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="-170 -170 340 340" aria-hidden="true">
      {DOTS.map((d, i) => (
        <circle key={i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={d.r.toFixed(1)} fill={d.c} />
      ))}
    </svg>
  );
}
