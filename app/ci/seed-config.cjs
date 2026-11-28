// Только выдуманные настройки на одноразовом Windows runner.
const { mkdirSync, writeFileSync } = require('node:fs');
const { scryptSync } = require('node:crypto');
const { join } = require('node:path');
if (process.env.GITHUB_ACTIONS !== 'true') throw Error('CI only');
const salt = Buffer.alloc(16, 7);
const pinHash = ['scrypt', salt.toString('hex'), scryptSync('2468', salt, 32).toString('hex')].join('$');
const dir = join(process.env.ProgramData, 'MaximaKiosk');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'config.json'), JSON.stringify({
  kioskUrl: 'https://kiosk.339933.net/', pinHash,
  jellyfin: { internalUrl: 'http://127.0.0.1:18996', user: 'ci-kiosk', password: 'ci-fake-password' },
}));
