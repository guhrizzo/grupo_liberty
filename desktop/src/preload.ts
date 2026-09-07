import { contextBridge, ipcRenderer } from 'electron'

// Ponte mínima. Só o que a tela offline e um eventual "sobre" precisam.
contextBridge.exposeInMainWorld('libertyDesktop', {
  retry: () => ipcRenderer.send('retry-load'),
  appVersion: () => ipcRenderer.invoke('app-version') as Promise<string>,
})
