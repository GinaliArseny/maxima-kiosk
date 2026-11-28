import { contextBridge, ipcRenderer } from 'electron';

export type ServiceAction = 'relaunch' | 'game-login' | 'desktop' | 'shutdown';

/** API сервисного окна (PIN и меню) — только эти вызовы, без доступа к Node. */
contextBridge.exposeInMainWorld('kiosk', {
  state: () => ipcRenderer.invoke('service:state'),
  submitPin: (pin: string) => ipcRenderer.invoke('service:pin', pin),
  setPin: (pin: string) => ipcRenderer.invoke('service:set-pin', pin),
  action: (name: ServiceAction) => ipcRenderer.invoke('service:action', name),
  protections: () => ipcRenderer.invoke('service:protections'),
  jellyfin: () => ipcRenderer.invoke('service:jellyfin'),
  saveJellyfin: (cfg: unknown) => ipcRenderer.invoke('service:save-jellyfin', cfg),
  testScreensaver: () => ipcRenderer.invoke('service:test-screensaver'),
  cancelTest: () => ipcRenderer.invoke('service:cancel-test'),
  onTestProgress: (cb: (lines: unknown) => void) => {
    const listener = (_event: unknown, lines: unknown) => cb(lines);
    ipcRenderer.on('service:test-progress', listener);
    return () => ipcRenderer.removeListener('service:test-progress', listener);
  },
  close: () => ipcRenderer.send('service:close'),
});
