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
  close: () => ipcRenderer.send('service:close'),
});
