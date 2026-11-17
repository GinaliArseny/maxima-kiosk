// Убирает из dist/ данные киоска: на сервере они живут в content/ и правятся админкой,
// выкладка сборки не должна их затирать.
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(import.meta.dirname, '../dist');
for (const d of ['data', 'docs', 'doctors']) rmSync(resolve(dist, d), { recursive: true, force: true });
