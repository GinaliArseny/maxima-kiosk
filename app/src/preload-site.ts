import { ipcRenderer } from 'electron';

/** Касания в левом верхнем углу (жест выхода) уходят в главный процесс. */
window.addEventListener(
  'pointerdown',
  (e) => {
    if (e.clientX <= 100 && e.clientY <= 100) ipcRenderer.send('corner-tap', { x: e.clientX, y: e.clientY });
  },
  { capture: true, passive: true },
);
