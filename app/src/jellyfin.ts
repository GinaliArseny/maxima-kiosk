export interface VideoItem {
  id: string;
  name: string;
}

interface JfItem {
  Id: string;
  Type: string;
  Name: string;
}

const VIDEO_TYPES = new Set(['Movie', 'Video', 'Episode', 'MusicVideo']);
const FOLDER_TYPES = new Set(['Folder', 'CollectionFolder', 'BoxSet', 'Season', 'Series']);
const PROBE_TIMEOUT_MS = 3000;
const REQUEST_TIMEOUT_MS = 15_000;
const APP_VERSION = '0.1.1';
const DEVICE_ID = 'maxima-kiosk-hall';

export interface JellyfinOptions {
  internalUrl: string;
  externalUrl?: string;
  user: string;
  password: string;
  fetch: typeof fetch;
}

/**
 * Клиент Jellyfin для заставки: вход пользователем «kiosk» (не ключом API),
 * раскрытие плейлистов и папок в список видео, ссылки на поток.
 */
export class JellyfinClient {
  private base = '';
  private token = '';
  private userId = '';

  constructor(private readonly o: JellyfinOptions) {}

  private authHeader() {
    const parts = [`Client="MaximaKiosk"`, `Device="Kiosk"`, `DeviceId="${DEVICE_ID}"`, `Version="${APP_VERSION}"`];
    if (this.token) parts.push(`Token="${this.token}"`);
    return `MediaBrowser ${parts.join(', ')}`;
  }

  /** Внутренний адрес первым (быстро, без интернета), иначе внешний. */
  async resolveBase(): Promise<string> {
    for (const url of [this.o.internalUrl, this.o.externalUrl].filter(Boolean) as string[]) {
      const base = url.replace(/\/+$/, '');
      try {
        const res = await this.o.fetch(`${base}/System/Info/Public`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
        if (res.ok) return (this.base = base);
      } catch {
        /* следующий адрес */
      }
    }
    throw new Error('Jellyfin недоступен ни по внутреннему, ни по внешнему адресу');
  }

  async login(): Promise<void> {
    this.token = '';
    const res = await this.o.fetch(`${this.base}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: this.authHeader() },
      body: JSON.stringify({ Username: this.o.user, Pw: this.o.password }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.status === 401) throw new Error('Jellyfin: неверный пользователь или пароль');
    if (!res.ok) throw new Error(`Jellyfin: вход не удался (${res.status})`);
    const body = (await res.json()) as { AccessToken: string; User: { Id: string } };
    this.token = body.AccessToken;
    this.userId = body.User.Id;
  }

  /** GET с токеном; на 401 — один повторный вход. */
  private async get<T>(path: string, retried = false): Promise<T | null> {
    const res = await this.o.fetch(`${this.base}${path}`, {
      headers: { Authorization: this.authHeader() },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.status === 401 && !retried) {
      await this.login();
      return this.get<T>(path, true);
    }
    if (!res.ok) return null;
    return (await res.json()) as T;
  }

  private async children(item: JfItem): Promise<JfItem[]> {
    const u = encodeURIComponent(this.userId);
    if (item.Type === 'Playlist') return (await this.get<{ Items: JfItem[] }>(`/Playlists/${item.Id}/Items?userId=${u}`))?.Items ?? [];
    const q = `ParentId=${item.Id}&Recursive=true&IncludeItemTypes=Movie,Video,Episode,MusicVideo&SortBy=SortName&userId=${u}`;
    return (await this.get<{ Items: JfItem[] }>(`/Items?${q}`))?.Items ?? [];
  }

  /** ID из настроек → видео по порядку. Фото, аудио и удалённые элементы пропускаются. */
  async expand(itemIds: string[]): Promise<VideoItem[]> {
    const out: VideoItem[] = [];
    for (const id of itemIds) {
      const item = (await this.get<{ Items: JfItem[] }>(`/Items?ids=${id}&userId=${encodeURIComponent(this.userId)}`))?.Items?.[0];
      if (!item) continue;
      const list = VIDEO_TYPES.has(item.Type)
        ? [item]
        : item.Type === 'Playlist' || FOLDER_TYPES.has(item.Type)
          ? await this.children(item)
          : [];
      for (const v of list) if (VIDEO_TYPES.has(v.Type)) out.push({ id: v.Id, name: v.Name });
    }
    return out;
  }

  /** Прямой поток файла (H.264/AAC играет без перекодирования). */
  streamUrl(itemId: string): string {
    return `${this.base}/Videos/${itemId}/stream?static=true&ApiKey=${encodeURIComponent(this.token)}`;
  }
}

/** Очередь роликов по кругу; сломанные пропускаются; все сломаны → null. */
export function createPlaylistCursor(items: VideoItem[]): { next(): VideoItem | null; markBroken(id: string): void } {
  const broken = new Set<string>();
  let pos = 0;
  return {
    next() {
      for (let i = 0; i < items.length; i++) {
        const item = items[pos % items.length];
        pos = (pos + 1) % items.length;
        if (!broken.has(item.id)) return item;
      }
      return null;
    },
    markBroken: (id) => void broken.add(id),
  };
}
