import { contextBridge, ipcRenderer } from 'electron';

/** API окна заставки: список роликов и «закрыть». */
contextBridge.exposeInMainWorld('saver', {
  items: () => ipcRenderer.invoke('screensaver:items'),
  playback: (event: { kind: string; id: string; code?: number }) => ipcRenderer.send('screensaver:playback', event),
  dismiss: () => ipcRenderer.send('screensaver:dismiss'),
});
