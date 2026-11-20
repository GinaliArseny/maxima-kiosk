const HEX32 = /^[0-9a-f]{32}$/i;

/**
 * ID элемента Jellyfin (видео, плейлист, папка) из того, что админ скопировал:
 * адрес из веб-интерфейса (…/web/#/details?id=…, библиотека …?topParentId=…, папка …?parentId=…),
 * ссылку на скачивание (…/Items/<id>/Download?ApiKey=…)
 * или голый ID. Всё остальное из ссылки (адрес сервера, ключ) отбрасывается. Не распознано → null.
 */
export function parseJellyfinLink(input: string): string | null {
  const text = input.trim();
  if (HEX32.test(text)) return text.toLowerCase();
  const m = /[?&](?:id|topParentId|parentId)=([0-9a-f]{32})(?:[&#]|$)/i.exec(text) ?? /\/Items\/([0-9a-f]{32})(?:[/?#]|$)/i.exec(text);
  return m ? m[1].toLowerCase() : null;
}
