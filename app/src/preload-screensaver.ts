import { contextBridge, ipcRenderer } from 'electron';

/** API окна заставки: список роликов и «закрыть». */
contextBridge.exposeInMainWorld('saver', {
  items: () => ipcRenderer.invoke('screensaver:items'),
  dismiss: () => ipcRenderer.send('screensaver:dismiss'),
});
