// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
it('быстрое касание после начала видео фиксирует успех перед закрытием, даже без timeupdate', async () => {
  vi.useFakeTimers();
  document.body.innerHTML = '<video id="fg"></video><video id="bg"></video>';
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const calls: string[] = [];
  (window as unknown as { saver: unknown }).saver = {
    items: async () => ({ items: [{ id: '1', name: 'Тест', url: 'http://test.local/video.webm' }], muted: true, test: true }),
    playback: (e: { kind: string }) => calls.push(e.kind),
    dismiss: () => calls.push('dismiss'),
  };
  await import('../src/screensaver-page');
  await Promise.resolve();
  const fg = document.getElementById('fg') as HTMLVideoElement;
  fg.currentTime = 0.35;
  window.dispatchEvent(new Event('pointerdown'));
  expect(calls).toEqual(['playing', 'dismiss']);
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();
});
