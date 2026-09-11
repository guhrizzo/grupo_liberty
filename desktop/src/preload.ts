import { contextBridge, ipcRenderer } from 'electron'

// Ponte mínima. Só o que a tela offline, o "sobre" e o login precisam.
contextBridge.exposeInMainWorld('libertyDesktop', {
  retry: () => ipcRenderer.send('retry-load'),
  appVersion: () => ipcRenderer.invoke('app-version') as Promise<string>,
  // Login pelo navegador do sistema (Google inclusive). Resolve quando o app
  // já recebeu a sessão e navegou pro dashboard; rejeita em erro/timeout.
  loginWithBrowser: () => ipcRenderer.invoke('login-with-browser') as Promise<void>,
})
