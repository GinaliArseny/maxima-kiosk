// Собирает сервер админки в два файла для Docker: main.mjs (сервис) и user.mjs (добавить пользователя).
// sharp — нативный модуль, ставится в образе отдельно.
import { build } from 'esbuild';
import { resolve } from 'node:path';

const dir = import.meta.dirname;
for (const [entry, out] of [
  ['server/main.ts', 'main.mjs'],
  ['server/userCli.ts', 'user.mjs'],
])
  await build({
    entryPoints: [resolve(dir, entry)],
    outfile: resolve(dir, 'server/dist', out),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    external: ['sharp'],
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    logLevel: 'warning',
  });
console.log('✓ admin/server/dist: main.mjs, user.mjs');
