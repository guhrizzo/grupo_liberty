# Plano de implementação — App desktop (casca Electron)

**Spec:** `docs/superpowers/specs/2026-09-07-app-desktop-design.md`
**Branch:** `feat/app-desktop`
**Data:** 2026-09-07

Verificação: `npm run build` na **raiz** segue limpo · `cd desktop && npm run build`
gera o instalador · testes manuais 1–8 do spec. Sem merge na master sem "ok".

Domínio de produção fixo: `https://grupolibertycar.com.br`.
Feed de update: bucket público `desktop-releases` no Supabase Storage.

---

## Passo 0 — Andaime da pasta `desktop/`

- `desktop/package.json` próprio (`"private": true`, `"main": "dist/main.js"`),
  **fora** do workspace da raiz (a raiz não tem `workspaces`, então basta não
  referenciar). Deps:
  - runtime: `electron-updater@^6`
  - dev: `electron@^34`, `electron-builder@^26`, `typescript@^5`,
    `electron-window-state@^5`, `@supabase/supabase-js@^2` (só pro script de
    publish), `png-to-ico` (gerar `.ico` no build), `electronmon` (reload no dev)
- `desktop/tsconfig.json`: `target ES2022`, `module NodeNext`, `outDir dist`,
  `rootDir src`, `strict`.
- Raiz `.gitignore` += `desktop/node_modules/`, `desktop/dist/`, `desktop/build/`,
  `desktop/.env`.
- `desktop/.env.example` com `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
  `RELEASE_BUCKET=desktop-releases` (só usados pelo script de publish, local).
- `desktop/README.md`: como rodar em dev, como buildar, como publicar release,
  e as **Limitações conhecidas** do spec (SmartScreen, precisa de internet,
  só Windows).

## Passo 1 — Config (`desktop/src/config.ts`)

```ts
export const APP_URL = process.env.APP_URL ?? 'https://grupolibertycar.com.br'
export const UPDATE_FEED_URL =
  process.env.UPDATE_FEED_URL ??
  'https://<PROJETO>.supabase.co/storage/v1/object/public/desktop-releases'
export const APP_ORIGINS = [           // origens tratadas como "dentro do app"
  'https://grupolibertycar.com.br',
  'https://www.grupolibertycar.com.br',
  'http://localhost:3000',
]
// domínios de auth liberados p/ navegação (se o login do Firebase redirecionar)
export const AUTH_ORIGINS = [
  'https://grupo-liberty.firebaseapp.com',
  'https://accounts.google.com',
]
```

> Substituir `<PROJETO>` pelo ref real do Supabase (o mesmo do
> `NEXT_PUBLIC` na raiz). Confirmar na hora da implementação.

## Passo 2 — Janela + estado (`desktop/src/window-state.ts`, `main.ts`)

- `window-state.ts`: usar `electron-window-state` (`defaultWidth 1280`,
  `defaultHeight 800`), `manage(win)`.
- `main.ts > createWindow()`:
  - `minWidth 1024`, `minHeight 640`, `backgroundColor '#0b1f3a'` (ajustar ao
    azul da marca), `icon` (Windows pega do exe; setar mesmo assim),
    `title 'Liberty Car'`, `autoHideMenuBar: false`.
  - `webPreferences`: `preload: dist/preload.js`, `contextIsolation: true`,
    `nodeIntegration: false`, `sandbox: true`, `spellcheck: true`.
  - `win.loadURL(APP_URL)`; **sem** pré-check de rede.

## Passo 3 — Tela offline (`desktop/src/offline.html` + preload)

- `did-fail-load` no `mainFrame` com `errorCode` de rede
  (`-105 -106 -109 -118 -2` etc., ou simplesmente `isMainFrame && errorCode <= -100`)
  → `win.loadFile('offline.html')`, guardando a última URL alvo.
- `offline.html`: página estática simples (logo, texto "Sem conexão com a
  internet", botão **Tentar de novo**). Estilo inline, tom da marca.
- `preload.ts` expõe via `contextBridge`:
  ```ts
  libertyDesktop = {
    retry: () => ipcRenderer.send('retry-load'),
    appVersion: () => ipcRenderer.invoke('app-version'),
    onUpdate: (cb) => ipcRenderer.on('update-status', (_e, s) => cb(s)),
  }
  ```
- `ipcMain.on('retry-load')` → tenta `loadURL(APP_URL)` de novo.
- Quando volta a carregar OK (`did-finish-load` numa APP_ORIGIN) nada a fazer;
  se falhar de novo, cai na offline.html outra vez.

## Passo 4 — Guardas de navegação e links (`main.ts`)

- `app.on('web-contents-created')` → no `contents`:
  - `setWindowOpenHandler(({ url }))`:
    - origem em `APP_ORIGINS` → `{ action: 'allow' }`? Não: preferir manter tudo
      na mesma janela; para `_blank` interno, `shell.openExternal` também serve.
      Decisão: **mesma origem abre externa no navegador** só se for download/pdf;
      caso contrário `deny` + `win.loadURL(url)`. Simplificar: `_blank` sempre
      externo (`shell.openExternal`) + `deny`. (rever no teste do fluxo de PDF).
  - `will-navigate`: se `new URL(url).origin` não está em
    `APP_ORIGINS ∪ AUTH_ORIGINS` → `event.preventDefault()` +
    `shell.openExternal(url)`.
- `session.defaultSession.setPermissionRequestHandler` → negar tudo que não for
  essencial (notifications, geolocation…). Liberar `clipboard-sanitized-write`.

## Passo 5 — Downloads / PDF (`main.ts`)

- `session.defaultSession.on('will-download', (e, item) => {...})`:
  - `item.setSavePath(path.join(app.getPath('downloads'), item.getFilename()))`
  - `item.once('done', (_e, state) => state === 'completed' &&
    shell.openPath(savePath))`
- Testar: rota de PDF que responde `inline` — Electron abre no viewer nativo;
  garantir que "salvar" dali cai no handler acima. Se `inline` não disparar
  download e o viewer nativo bastar, ok.

## Passo 6 — Menu pt-BR (`desktop/src/menu.ts`)

- `Menu.buildFromTemplate` com: **Liberty Car** (Sobre → `dialog` com versão +
  botão "Procurar atualizações"; Sair), **Editar** (roles padrão),
  **Exibir** (Recarregar, ForceReload só em dev, Zoom in/out/reset, Tela cheia),
  **Janela** (Minimizar, Fechar), **Ajuda** (Abrir site no navegador →
  `shell.openExternal(APP_URL)`; Procurar atualizações).
- DevTools: registrar `globalShortcut` `Ctrl+Shift+I` só quando
  `!app.isPackaged`.

## Passo 7 — Auto-update (`desktop/src/updater.ts`)

- `electron-updater`:
  ```ts
  autoUpdater.setFeedURL({ provider: 'generic', url: UPDATE_FEED_URL })
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  ```
- Em `app.whenReady()` (só se `app.isPackaged`): `checkForUpdates()` e
  `setInterval(6h)`.
- Eventos → manda `update-status` pro renderer (opcional) e:
  - `update-downloaded` → `dialog.showMessageBox` [Reiniciar agora]/[Depois];
    "Reiniciar" → `autoUpdater.quitAndInstall()`.
  - `error` → `log` só (console + `app.getPath('logs')` via `electron-updater`
    logger). Não mostra pop-up.
- `ipcMain.handle('check-updates-manual')` para o item de menu, com feedback
  ("na última versão" / "baixando…").

## Passo 8 — Instância única + ciclo de vida (`main.ts`)

- `app.requestSingleInstanceLock()`; se falha → `app.quit()`.
  `second-instance` → restaura/foca a janela.
- `window-all-closed` → `app.quit()` (inclusive no macOS aqui, já que é
  Windows-only).

## Passo 9 — Ícone (`desktop/assets/`)

- `logo-liberty-car-blue.png` é wordmark 721×280 — **não serve** como ícone
  quadrado.
- Stopgap: gerar `assets/icon.png` 1024×1024 = wordmark centralizado sobre fundo
  da marca (script `desktop/scripts/make-icon.mjs` com `sharp`, ou compor à mão
  uma vez e commitar). `png-to-ico` gera `assets/icon.ico` no `prebuild`.
- Marcar no README: **trocar pelo ícone oficial** quando houver.

## Passo 10 — Empacotamento (`desktop/electron-builder.yml`)

```yml
appId: br.com.grupoliberty.libertycar
productName: Liberty Car
directories: { output: build, buildResources: assets }
files: [dist/**, assets/**, package.json]
win:
  target: [{ target: nsis, arch: [x64] }]
  icon: assets/icon.ico
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: Liberty Car
artifactName: Liberty-Car-Setup-${version}.exe
publish: { provider: generic, url: <UPDATE_FEED_URL> }
```

## Passo 11 — Script de publish (`desktop/scripts/publish.mjs`)

- Lê `desktop/.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `RELEASE_BUCKET`).
- Depois do `electron-builder --win` (sem `--publish`), faz upload de
  `build/latest.yml`, `build/Liberty-Car-Setup-*.exe`,
  `build/*.exe.blockmap` pro bucket (`upsert: true`, `contentType` correto).
- Loga as URLs finais. Idempotente.
- `npm run release` = `npm run build && node scripts/publish.mjs`.

## Passo 12 — Scripts (`desktop/package.json`)

```json
"scripts": {
  "clean": "rimraf dist build",
  "compile": "tsc",
  "dev": "tsc && cross-env APP_URL=http://localhost:3000 electronmon dist/main.js",
  "prebuild": "node scripts/make-icon.mjs && node scripts/ico.mjs",
  "build": "tsc && electron-builder --win",
  "release": "npm run build && node scripts/publish.mjs"
}
```
(ajustar nomes/ferramentas conforme o que instalar de fato.)

## Passo 13 — Verificação

1. Raiz: `npm run build` limpo (nada de `desktop/` no bundle da Vercel).
2. `cd desktop && npm i && npm run dev` com o site local no ar:
   - janela abre, login, sessão persiste ao fechar/reabrir;
   - gerar PDF (proposta/contrato) → abre/baixa;
   - link externo → navegador padrão; navegar pra fora → bloqueado;
   - internet off → tela offline + "Tentar de novo" recupera.
3. `npm run build` → instala `Liberty-Car-Setup-1.0.0.exe` em máquina limpa →
   atalho no Menu Iniciar, abre.
4. Publicar `1.0.1` no bucket → app na `1.0.0` detecta, baixa, pergunta, atualiza.

## Passo 14 — Commits (branch `feat/app-desktop`)

Sequência sugerida, um commit por bloco coeso:
1. `chore(desktop): andaime do app Electron (pasta desktop/, spec, plano)`
2. `feat(desktop): janela, tela offline e guardas de navegação`
3. `feat(desktop): menu pt-BR, downloads de PDF e instância única`
4. `feat(desktop): auto-update via feed generic (Supabase Storage)`
5. `build(desktop): empacotamento NSIS + script de publish + ícone`

Parar antes do merge. PR só com "ok".

## Pendências que dependem de você (fora do código)

- Criar o bucket público `desktop-releases` no Supabase (ou eu deixo o script
  criando na primeira publicação, se a service key permitir).
- Apontar `grupolibertycar.com.br` para a Vercel (domínio + DNS) antes do 1º
  release de verdade — o dev/local não precisa disso.
- Futuro: certificado de assinatura de código (remove aviso do SmartScreen).
