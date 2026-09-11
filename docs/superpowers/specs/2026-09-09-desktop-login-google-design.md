# Login com Google no app desktop — handoff pelo navegador

**Data:** 2026-09-09
**Status:** rascunho (aguardando aprovação)
**Branch:** `feat/desktop-login-google`
**Relacionado:** `docs/superpowers/specs/2026-09-07-app-desktop-design.md`

## Problema / objetivo

O app desktop (Electron, casca sobre o site publicado) só faz login com
**e-mail/senha**. O botão "Continuar com Google" some quando a página roda no
Electron (`window.libertyDesktop`), porque o `signInWithPopup` do Firebase não
fecha o fluxo de forma confiável dentro do Electron — já foi tentado
(`5c9aae3`) e abandonado (`af3592f`).

Na prática **quase todo mundo entra no sistema com Google**; e-mail/senha é
exceção. Sem Google, o app desktop é pouco usável — as pessoas teriam que criar
e lembrar uma senha só pra ele.

Restrição do dono do projeto: **não mexer no Google Cloud / Firebase Console**
(criar credencial OAuth, ajustar provedores). A solução tem que viver só no
código que controlamos.

## Não-objetivos

- OAuth nativo dentro da janela do app (exigiria um OAuth client "Desktop" no
  Google Cloud + liberar o client ID no provedor Google do Firebase).
- Protocolo `libertycar://` / deep-linking.
- Qualquer mudança no login pelo **navegador comum** (site) — Google e
  e-mail/senha continuam idênticos lá.
- Refresh automático da sessão de 5 dias — ao expirar, a pessoa refaz o "Entrar
  com o navegador" (1 clique).
- Reabilitar `signInWithPopup` no Electron.

## Arquitetura (Abordagem A — handoff pelo navegador + cookie de sessão)

O app **não faz OAuth**. Ele delega o login pro navegador do sistema (que já
sabe logar com Google — o site tem os domínios autorizados) e recebe de volta um
**cookie de sessão** já pronto, pelo mesmo mecanismo que `loginWithGoogle` /
`login` usam hoje.

```
APP (Electron)                        NAVEGADOR DO SISTEMA            SERVIDOR (Vercel)
──────────────                        ────────────────────           ─────────────────
"Entrar com o navegador"
  │ sobe http://127.0.0.1:<porta>     (loopback, porta efêmera)
  │ abre o navegador ───────────────► /entrar-dispositivo?porta&state
  │                                    │ não logado → <LoginForm> normal
  │                                    │   (Google / e-mail-senha / vincular conta)
  │                                    │ logado → card "Autorizar app como X?" [Autorizar]
  │                                    │        └─► action criarCodigoDispositivo()
  │                                    │             device_logins/<code> = { uid, +2min }
  │ ◄── redirect 127.0.0.1/callback?code=<code>&state=<state>
  │ confere state; responde "pode fechar"; fecha o loopback
  │ POST /api/desktop/exchange { code } ───────────────────────────► valida code (uso único, fresco)
  │                                                                   customToken = createCustomToken(uid)
  │                                                                   idToken = signInWithCustomToken (REST)
  │ ◄────────── Set-Cookie: session=… (httpOnly, 5 dias) ──────────── createSessionCookie(idToken)
  │ cookie entra na sessão do Electron (net.fetch → defaultSession)
  │ mainWindow.loadURL(APP_ORIGIN/dashboard) → logado
```

**Zero configuração no Google Cloud / Firebase Console.** Reaproveita
`<LoginForm>` inteiro (Google, e-mail/senha, `linkWithPopup` de vínculo de
conta — tudo funciona porque é um navegador real num domínio autorizado) e o
padrão de cookie `session` que as actions atuais já gravam.

### Por que não as alternativas

- **OAuth nativo no Electron (system browser + Google OAuth client + PKCE +
  `signInWithCredential`)**: login fica 100% dentro da janela, mas **exige as
  configs de console que o dono não vai mexer** e traz a questão de onde guardar
  o client secret.
- **Reabilitar `signInWithPopup`**: já foi tentado e abandonado neste projeto;
  baixa confiança de estabilidade.

## Componentes

### 1. Web — página `/entrar-dispositivo`

`app/entrar-dispositivo/page.tsx` (server component) + `EntrarDispositivoClient.tsx`.

- **Query params:** `porta` (obrigatório, inteiro 1024–65535), `state`
  (obrigatório, opaco). Faltando/inválido → tela de erro "Abra pelo app Liberty
  Car".
- **Não logado:** renderiza
  `<LoginForm redirect="/entrar-dispositivo?porta=…&state=…" />`. Google,
  e-mail/senha e o fluxo de vincular conta (`linkWithPopup`) funcionam — é um
  navegador de verdade.
  - **Pré-requisito:** hoje a prop `redirect` do `<LoginForm>` é passada mas
    **ignorada** — `login` e `loginWithGoogle` fazem `redirect('/dashboard')`
    fixo. Parte deste trabalho é ligar essa prop: as actions passam a ler o
    destino (campo do FormData no `login`; 2º argumento no `loginWithGoogle`),
    **validar que é um caminho relativo do próprio site** (começa com `/`, sem
    `//` nem esquema) e redirecionar pra lá; default continua `/dashboard`.
    Assim o login no navegador volta pra `/entrar-dispositivo?porta&state` e a
    página cai no ramo "logado".
- **Logado:** card de consentimento — "Entrar no app Liberty Car como
  **fulano@email.com**?" + `[Autorizar]` e `[Não sou eu / trocar de conta]`. O
  clique é **obrigatório** — nada dispara sozinho (evita transferência silenciosa
  de sessão se a pessoa já estava logada no site).
- **`[Autorizar]`** → server action `criarCodigoDispositivo()`:
  - pega o `uid` do cookie de sessão (mesmo helper das outras actions)
  - `code` = 32 bytes aleatórios (base64url)
  - grava `device_logins/{code}` = `{ uid, email, createdAt: serverTimestamp,
    expiresAt: now + 2min, usedAt: null }`
  - retorna `{ code }`
  - o client faz
    `window.location.href = "http://127.0.0.1:" + porta + "/callback?code=" + code + "&state=" + state`
    — **só** redireciona pra `127.0.0.1`/`localhost` (trava contra open-redirect).
- **`[Não sou eu]`** → `logout()` e recarrega a página (volta pro `<LoginForm>`).
- A rota não é pega por `internalRedirectFor` (regex de vitrine é
  `^/$|^/(veiculos|public)(/|$)`) nem pelo guard de navegação do Electron (abre no
  navegador do sistema).

### 2. Web — `POST /api/desktop/exchange`

`app/api/desktop/exchange/route.ts` (`export const runtime = 'nodejs'`, sem auth).

1. body `{ code }` — valida formato
2. rate-limit leve por IP (o `code` tem 256 bits, não é brute-forçável; é só
   anti-abuso)
3. lê `device_logins/{code}`; rejeita (`400`) se não existe, `usedAt != null`, ou
   `now > expiresAt`
4. `transaction` marcando `usedAt = serverTimestamp` — uso único mesmo com corrida
5. `customToken = await adminAuth.createCustomToken(uid)`
6. `idToken` via
   `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=<NEXT_PUBLIC_FIREBASE_API_KEY>`
   `{ token: customToken, returnSecureToken: true }` — mesmo padrão REST do
   `login` de e-mail/senha
7. confere `profiles/{uid}` existe (defensivo). Se não existir → `403` e **não**
   deleta o usuário do Auth (diferente do `loginWithGoogle`, que limpa órfãos do
   popup — aqui não há órfão a limpar)
8. `sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: 5 *
   24 * 3600 * 1000 })`
9. `cookieStore.set('session', sessionCookie, { httpOnly: true, secure: true,
   path: '/', sameSite: 'lax', maxAge: 5 * 24 * 3600 })` — idêntico ao que
   `loginWithGoogle` grava
10. responde `{ ok: true }`
11. limpeza oportunista: apaga alguns `device_logins` expirados por chamada (ou
    TTL policy no Firestore — decidir no plano)

O `Set-Cookie` volta no header da resposta; o Electron captura na sessão.

### 3. Electron — `desktop/src/device-login.ts` (novo)

```ts
export async function loginWithBrowser(getWindow: () => BrowserWindow | null): Promise<void>
```

- Guard de "já em andamento" — fecha o servidor anterior se a pessoa clicar 2x.
- `state = randomBytes(16).toString('hex')`.
- `http.createServer(...)` → `server.listen(0, '127.0.0.1')` → porta atribuída
  pelo SO.
- Timeout de **3 min** → `server.close()`, rejeita (`'timeout'`).
- No `GET /callback?code&state`:
  - confere `state`; não bate → responde `400`, ignora
  - responde `200` com HTML mínimo: "Login concluído — pode fechar esta aba e
    voltar ao app"
  - `server.close()`, limpa timeout
  - `res = await net.fetch(APP_ORIGIN + '/api/desktop/exchange', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })`
    — via `net` (sessão `defaultSession`), o `Set-Cookie` da resposta entra na
    cookie jar da sessão automaticamente. **Fallback:** se não entrar, ler o
    header `set-cookie` e `session.defaultSession.cookies.set(...)` manual
    (validar qual caminho funciona na implementação).
  - `!res.ok` → rejeita com a mensagem do corpo
  - `getWindow()?.loadURL(APP_URL)` → recarrega já logado; resolve a Promise
- IPC: `ipcMain.handle('login-with-browser', () => loginWithBrowser(getWindow))`.

`desktop/src/preload.ts` ganha:
```ts
loginWithBrowser: () => ipcRenderer.invoke('login-with-browser') as Promise<void>
```

### 4. `app/login/actions.ts` — ligar a prop `redirect`

- `login(formData)`: ler `formData.get('redirect')`, sanitizar
  (`safeInternalPath(p) → começa com "/" && !começa com "//" && sem ":"`; senão
  `/dashboard`), usar no `redirect(...)` final.
- `loginWithGoogle(idToken, redirectTo?)`: novo 2º parâmetro, mesma sanitização.
  `LoginForm` passa `redirect` nas duas chamadas.
- Extrair `safeInternalPath` para um helper reutilizável (usado pelo `exchange`
  também, se precisar).

### 5. `app/login/LoginForm.tsx` — ramo desktop

Hoje `isDesktopApp` só esconde o botão do Google. Passa a:

- **`isDesktopApp === true`:** botão primário grande **"Entrar com o navegador"**
  → `window.libertyDesktop.loginWithBrowser()`. Pendente: "Abrindo o navegador…
  conclua o login lá e volte." Resolveu: nada a fazer (o Electron já navegou).
  Rejeitou: toast ("Login não concluído. Tente de novo.").
  Abaixo, um `<details>` "ou entrar com e-mail e senha" com o form atual (segue
  funcionando in-app).
- **`isDesktopApp === false`:** **nada muda**.

O tipo de `window.libertyDesktop` (hoje inline em `LoginForm`) ganha
`loginWithBrowser?: () => Promise<void>`.

### 6. Limpeza da infra do popup abandonado

Parte deste trabalho — era da abordagem que estamos substituindo:

- `desktop/src/main.ts`: remove a limpeza de User-Agent (`session.setUserAgent`
  tirando "Electron"/"Liberty Car") e o ramo de janela-filha para `AUTH_ORIGINS`
  no `setWindowOpenHandler` (volta ao comportamento padrão: origem externa →
  `shell.openExternal` + `deny`).
- `desktop/src/config.ts`: `AUTH_ORIGINS` — decidir no plano entre manter no
  allowlist de navegação (inofensivo, com comentário "não usado p/ OAuth") ou
  remover junto de `isAllowedNavigation`.
- `desktop/README.md`: reescrever a seção "Login".

## Modelo de dados

### Coleção nova `device_logins`

| campo | tipo | obs |
|---|---|---|
| id do doc | string | o `code` (32 bytes base64url) |
| `uid` | string | usuário autenticado que autorizou |
| `email` | string | só para log/inspeção |
| `createdAt` | Timestamp | `serverTimestamp()` |
| `expiresAt` | Timestamp | `createdAt + 2min` |
| `usedAt` | Timestamp \| null | marcado na troca; uso único |

TTL policy do Firestore em `expiresAt` (ou limpeza oportunista no `exchange`).

## Segurança

- `code`: 256 bits, uso único (transação em `usedAt`), TTL 2 min, trocado na hora.
- `state`: liga o callback à tentativa de login que o app iniciou; `state` errado
  no callback → ignorado.
- Loopback só em `127.0.0.1`, porta efêmera escolhida **antes** de abrir o
  navegador.
- O `code` na URL do redirect fica no histórico de `127.0.0.1` do navegador —
  inútil após uso/expiração. **ID token e cookie de sessão nunca passam pela URL
  nem pelo navegador.**
- Consentimento explícito na página antes de gerar o `code` — sem transferência
  silenciosa de sessão.
- `exchange` nunca deleta usuário; só cria sessão para `profiles` já existente.
- Nenhum segredo novo no `.exe` (mantém o princípio do spec do app desktop).

## Plano de testes (manual)

1. App desktop (dev), sem sessão → "Entrar com o navegador" → navegador abre em
   `/entrar-dispositivo` → login com Google lá → volta pro app logado em
   `/dashboard`.
2. Começando **já logado** no site no navegador → só o card de consentimento →
   `[Autorizar]` → volta logado.
3. E-mail/senha dentro do app (o `<details>`) continua funcionando.
4. Vincular conta (e-mail tinha senha, sem Google) pelo fluxo do navegador →
   funciona.
5. Fechar o navegador no meio → após 3 min o app mostra "Login não concluído".
6. `code` reusado (repetir o `POST /exchange`) → `400`.
7. `state` adulterado no callback → app ignora.
8. Sessão persiste ao fechar/reabrir o app.
9. `[Não sou eu]` → volta pro `<LoginForm>` no navegador.
10. `npm run build` na raiz limpo; `cd desktop && npm run build` gera o
    instalador; smoke test do fluxo no `.exe` empacotado.

## Decisões em aberto para o plano

- `Set-Cookie` automático via `net.fetch` vs `cookies.set` manual — validar na
  implementação qual funciona no Electron.
- `AUTH_ORIGINS`: manter comentado ou remover.
- Limpeza de `device_logins`: TTL policy no Firestore (precisa de config no
  console — que queremos evitar) vs limpeza oportunista no código. Provável:
  oportunista.
- Ler `node_modules/next/dist/docs/` (Route Handlers, cookies em route handler,
  server actions) antes de escrever — Next.js com breaking changes (AGENTS.md).
