// Сборка программы-киоска: главный процесс и preload — CommonJS для Electron, страницы — IIFE для браузера.
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = import.meta.dirname;
const common = { bundle: true, logLevel: 'warning', sourcemap: false, legalComments: 'none' };
const entries = (names) => names.map((n) => resolve(dir, 'src', `${n}.ts`)).filter((p) => existsSync(p));

await build({
  ...common,
  entryPoints: entries(['main', 'preload-site', 'preload-service', 'preload-screensaver']),
  outdir: resolve(dir, 'dist'),
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['electron'],
});

await build({
  ...common,
  entryPoints: entries(['service-page', 'screensaver-page']),
  outdir: resolve(dir, 'dist'),
  platform: 'browser',
  target: 'chrome130',
  format: 'iife',
});
console.log('✓ app/dist');
