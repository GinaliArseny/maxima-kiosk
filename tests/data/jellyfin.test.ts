import { describe, expect, it } from 'vitest';
import { parseJellyfinLink } from '../../src/data/jellyfin';

// Значения выдуманные, формат — как у ссылок Jellyfin клиники.
const ID = 'aaaabbbbccccddddeeeeffff00001111';
const KEY = '0123456789abcdef0123456789abcdef';

describe('Ссылки Jellyfin для заставки', () => {
  it.each([
    ['ссылка из веб-интерфейса', `http://192.168.1.10:8096/web/#/details?id=${ID}&serverId=99998888777766665555444433332222`],
    ['ссылка на скачивание во внутренней сети', `http://192.168.1.10:8096/Items/${ID}/Download?ApiKey=${KEY}`],
    ['ссылка на скачивание через внешний адрес', `https://video.example.ru/Items/${ID}/Download?ApiKey=${KEY}`],
    ['голый ID с пробелами', `  ${ID} `],
  ])('%s → ID элемента', (_, link) => {
    expect(parseJellyfinLink(link)).toBe(ID);
  });

  it('ключ из ссылки никогда не принимается за ID', () => {
    expect(parseJellyfinLink(`https://video.example.ru/System/Info?ApiKey=${KEY}`)).toBeNull();
  });

  it('посторонняя ссылка → null', () => {
    expect(parseJellyfinLink('https://example.com')).toBeNull();
    expect(parseJellyfinLink('')).toBeNull();
  });
});
