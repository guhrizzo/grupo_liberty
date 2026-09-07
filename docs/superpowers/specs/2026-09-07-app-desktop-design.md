# App desktop (Liberty Car) — casca Electron sobre o site publicado

**Data:** 2026-09-07
**Status:** rascunho (aguardando aprovação)
**Relacionado:** —

## Problema / objetivo

Hoje o sistema só existe como site (Next.js na Vercel). O pedido é que ele "vire
um software": um programa instalável no Windows, com ícone próprio, janela
dedicada (sem barra de endereço do navegador), atalho no menu Iniciar e
atualização automática quando uma nova versão sai.

Decisão de arquitetura (já tomada): **casca fina**. O executável é um
**Electron** que carrega o site **já publicado na Vercel**. O backend continua
100% na nuvem — nada de segredos do Firebase/Resend dentro do instalador, nada de
servidor Next rodando na máquina do usuário.

O app desktop é **só o sistema interno**: abre direto em `/dashboard` (sem
sessão, o próprio site manda pra `/login`; com sessão, entra direto). A vitrine
pública (`/`, `/veiculos/*`) não aparece — qualquer navegação pra ela é
redirecionada pro sistema interno. O site público segue existindo no navegador,
normal.

Consequência aceita: **exige internet** para funcionar (igual ao site hoje). Modo
offline de verdade (banco local) está fora deste escopo.

## Não-objetivos

- Rodar o Next.js dentro do app / funcionar sem internet.
- Trocar Firebase/Supabase por banco local ou sincronização offline.
- Builds para macOS e Linux (só Windows x64 por enquanto).
- Assinatura de código (certificado Authenticode pago) — ver "Limitações".
- Qualquer mudança no comportamento do app Next.js. O objetivo é **zero alteração**
  em `app/`, `utils/`, etc. (a única exceção possível: um `<meta>`/detecção de
  "estou no app" se for necessário — só se precisar).
- Push notifications nativas, tray icon, deep-linking por protocolo
  (`libertycar://`). Podem vir depois.

## Estrutura no repositório

Tudo isolado numa pasta nova `desktop/`, com o próprio `package.json`. O
`package.json` da raiz **não muda** (nenhuma dep de Electron entra no build da
Vercel).

```
desktop/
  package.json            # electron, electron-builder, electron-updater
  electron-builder.yml     # config de empacotamento (NSIS) + publish
  tsconfig.json
  src/
    main.ts               # processo principal: janela, menu, update, guardas
    preload.ts            # ponte mínima (contextBridge) — só o necessário
    offline.html          # tela de "sem conexão" com botão Repetir
    window-state.ts       # persistência de tamanho/posição da janela
  assets/
    icon.ico              # ícone do app (a partir de logo-liberty-car-blue.png)
    installer-sidebar.bmp # arte do instalador NSIS (164x314) — opcional
  build/                  # saída do electron-builder (gitignored)
```

`.gitignore` da raiz ganha `desktop/node_modules/` e `desktop/build/`.

## Configuração (build-time)

`desktop/src/config.ts` lê de env na hora do build:

| var | dev | prod |
|---|---|---|
| `APP_ORIGIN` | `http://localhost:3000` | `https://grupolibertycar.com.br` |
| `APP_URL` (derivado) | `<APP_ORIGIN>/dashboard` | `<APP_ORIGIN>/dashboard` |
| `UPDATE_FEED_URL` | — | URL pública do bucket Supabase (ver "Atualização automática") |

Domínio de produção: **`grupolibertycar.com.br`** (apex e `www.` contam como
mesma origem para as guardas de navegação). Pré-requisito: esse domínio precisa
estar apontado para o deploy da Vercel antes do primeiro release.

## Processo principal (`main.ts`)

### Janela

- `BrowserWindow` 1280×800 por padrão, mínimo 1024×640, restaura último
  tamanho/posição/estado maximizado (`window-state.ts`, salvo em
  `app.getPath('userData')/window-state.json`).
- `title: 'Liberty Car'`, ícone `assets/icon.ico`.
- `webPreferences`: `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `preload`.
- `backgroundColor` no tom da identidade (evita flash branco).
- Sessão persistente (padrão do Electron em `userData`) → **login do Firebase
  continua salvo** entre aberturas.

### Carregamento e tela offline

- Ao abrir: se `net.isOnline()` → `loadURL(APP_URL)`; senão → `loadFile(offline.html)`.
- `webContents.on('did-fail-load')` (erro de rede no frame principal) → carrega
  `offline.html`. Botão "Tentar de novo" chama de volta o `loadURL(APP_URL)`.
- Sem "dinossauro do Chrome" em nenhum caso.

### Navegação e links externos (segurança)

- `webContents.setWindowOpenHandler`: `target=_blank` / `window.open` de mesma
  origem (ex.: "abrir PDF") → janela filha própria. Origem diferente → navegador
  padrão (`shell.openExternal`) + nega a janela nova.
- `webContents.on('will-navigate'` / `'will-redirect')`:
  - rota pública (`/`, `/veiculos/*`, `/public/*`) → redireciona pra `/dashboard`;
  - origem fora de `APP_ORIGINS ∪ AUTH_ORIGINS` → bloqueia (e abre no navegador
    se for http/https).
- Domínios de auth liberados: `grupo-liberty.firebaseapp.com`,
  `accounts.google.com`, `apis.google.com` (rede de segurança caso o login use
  redirect — o fluxo atual é por cookie de sessão, sem popup).

### Downloads / PDFs

O sistema gera PDF em rotas do servidor (contratos, propostas, comprovantes,
cobranças) que respondem `inline` ou como download.

- `session.defaultSession.on('will-download')`: salva em
  `app.getPath('downloads')`, e ao terminar abre com `shell.openPath` (abre no
  leitor de PDF padrão do Windows).
- Links `inline` de PDF que o Chromium abriria no viewer embutido: manter o
  comportamento nativo do Electron (tem viewer de PDF). Só garantir que um
  "baixar" no viewer cai no fluxo acima.

### Menu (pt-BR)

Menu enxuto, sem itens irrelevantes de navegador:

- **Liberty Car**: Sobre (versão + "procurar atualizações"), Sair.
- **Editar**: Desfazer/Refazer/Recortar/Copiar/Colar/Selecionar tudo (roles
  padrão — necessários pros formulários).
- **Exibir**: Recarregar, Zoom + / − / reset, Tela cheia. **Sem** "DevTools" em
  produção (só em dev, ou atrás de `Ctrl+Shift+I` escondido).
- **Janela**: Minimizar, Fechar.
- **Ajuda**: "Abrir site no navegador", "Procurar atualizações".

### Instância única

`app.requestSingleInstanceLock()` — segunda execução foca a janela existente.

## Atualização automática

`electron-updater` no processo principal.

- Provider **generic**: `electron-builder` publica os artefatos
  (`latest.yml`, `Liberty-Car-Setup-x.y.z.exe`, `.blockmap`) num destino HTTPS
  público e estático; o app consulta `UPDATE_FEED_URL/latest.yml`.
- Destino escolhido: **bucket público do Supabase Storage** (já temos Supabase;
  URL estável, custo zero, escala). Bucket dedicado, ex.: `desktop-releases`,
  com `public: true`. `UPDATE_FEED_URL` =
  `https://<projeto>.supabase.co/storage/v1/object/public/desktop-releases`.
- Fluxo: no `ready`, e depois a cada 6h, `autoUpdater.checkForUpdates()`.
  - `update-downloaded` → `dialog` "Atualização pronta. Reiniciar agora?"
    [Reiniciar] / [Depois]. "Reiniciar" → `autoUpdater.quitAndInstall()`.
  - Erro de update → silencioso (log), não incomoda o usuário.
- `Ajuda › Procurar atualizações` força o check e dá feedback ("já está na última
  versão" / "baixando…").

`electron-builder.yml > publish` fica como `provider: generic` +
`url: <UPDATE_FEED_URL>`. O upload dos artefatos para o bucket é feito por um
script `desktop/scripts/publish.mjs` (usa a service key do Supabase, lida de env
local — nunca commitada), já que o `--publish` nativo do electron-builder não tem
provider Supabase.

## Empacotamento (`electron-builder.yml`)

- `appId: br.com.grupoliberty.libertycar`
- `productName: Liberty Car`
- Target: **NSIS** (instalador `.exe`), `oneClick: false` (deixa escolher pasta),
  `perMachine: false` (instala por usuário — não pede admin),
  `allowToChangeInstallationDirectory: true`, atalhos no Desktop e Menu Iniciar.
- `artifactName: Liberty-Car-Setup-${version}.exe`
- Ícone `assets/icon.ico`.
- `publish` conforme Pendência 2.

## Scripts (`desktop/package.json`)

- `dev` — `APP_URL=http://localhost:3000` + `electron` apontando pro `main.ts`
  compilado (tsc watch) ou via `electron-vite`/`tsx`. (definir no plano)
- `build` — `tsc` + `electron-builder --win` (gera instalador em `desktop/build/`)
- `release` — `electron-builder --win --publish always` (build + sobe feed)

Requer o site rodando (`npm run dev` na raiz) para o `desktop dev`.

## Versionamento

Versão do app desktop = campo `version` do `desktop/package.json`. Começa em
`1.0.0`. Bump manual a cada release (o plano pode adicionar um script depois).
Independente da versão do site (que não versiona).

## Limitações conhecidas (documentar no README do `desktop/`)

1. **Sem assinatura de código.** O Windows SmartScreen vai mostrar "app não
   reconhecido" na primeira instalação (usuário clica em "Mais informações →
   Executar assim mesmo"). Resolver depois exige certificado Authenticode
   (~US$ 200–400/ano) ou EV. Anotar como follow-up.
2. **Precisa de internet.** Sem conexão → tela offline, não abre o sistema.
3. **Só Windows x64.**
4. O cron de cobrança (`vercel.json`) continua na Vercel — não muda nada.

## Testes (manual)

1. `desktop dev` com o site local no ar → abre direto na tela de **login**
   (sem sessão) ou no dashboard (com sessão); sessão persiste ao fechar/reabrir.
   Tentar abrir `/` ou `/veiculos/<id>` → cai no sistema interno, não na vitrine.
2. Gerar um PDF (proposta/contrato) → abre/baixa corretamente.
3. Clicar num link externo (ex.: rodapé, e-mail de suporte) → abre no navegador
   padrão, não dentro do app.
4. Tentar navegar pra fora da origem → bloqueado.
5. Desligar a internet e abrir o app → tela "sem conexão" + "Tentar de novo"
   religa quando a rede volta.
6. `desktop build` → gera `Liberty-Car-Setup-1.0.0.exe`; instala numa máquina
   limpa; atalho no Menu Iniciar; abre.
7. Publicar `1.0.1` no feed → app aberto na `1.0.0` detecta, baixa, pergunta e
   atualiza ao reiniciar.
8. `npm run build` na **raiz** segue limpo (desktop não interfere no build da
   Vercel).
