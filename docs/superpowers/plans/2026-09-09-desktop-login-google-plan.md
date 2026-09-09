# Plano de implementação — Login com Google no app desktop

**Spec:** `docs/superpowers/specs/2026-09-09-desktop-login-google-design.md`
**Branch:** `feat/desktop-login-google`
**Data:** 2026-09-09

Verificação global: `npm run build` na raiz limpo · `npx tsc --noEmit` limpo ·
`eslint` sem regressão · `cd desktop && npm run compile` limpo · walkthrough
manual (testes 1–10 do spec). **Sem merge na master sem "ok".**

Antes de escrever código: ler em `node_modules/next/dist/docs/` os guias de
**Route Handlers**, **cookies em route handler / server action** e **App Router
(pages/searchParams)** — Next.js com breaking changes (AGENTS.md).

Constantes que atravessam os lados:
- cookie de sessão: `name: 'session'`, `httpOnly: true`,
  `secure: NODE_ENV === 'production'`, `path: '/'`, `sameSite: 'lax'`,
  `maxAge/expiresIn = 5 * 24 * 3600` — **idêntico** ao que `login` /
  `loginWithGoogle` já gravam. Não inventar valores novos.
- `APP_ORIGIN` no desktop: `http://localhost:3000` em dev,
  `https://grupolibertycar.com.br` em prod (`desktop/src/config.ts`).

---

## Passo 1 — Ligar a prop `redirect` do login

**`app/login/actions.ts`**

```ts
/** Caminho relativo seguro do próprio site (evita open-redirect). */
export function safeInternalPath(p: unknown): string {
  const s = typeof p === 'string' ? p.trim() : ''
  if (!s.startsWith('/') || s.startsWith('//') || s.includes('\\')) return '/dashboard'
  try {
    // rejeita esquema embutido / paths malformados
    const u = new URL(s, 'https://x.invalid')
    return u.pathname + u.search
  } catch {
    return '/dashboard'
  }
}
```
(módulo próprio `utils/safeInternalPath.ts` se `actions.ts` reclamar de export
não-async — provavelmente sim, tem `'use server'`. Colocar lá e importar.)

- `login(_prev, formData)`: no fim,
  `redirect(safeInternalPath(formData.get('redirect')))` no lugar de
  `redirect('/dashboard')`.
- `loginWithGoogle(idToken, redirectTo?)`: novo 2º parâmetro;
  `redirect(safeInternalPath(redirectTo))` no fim.

**`app/login/LoginForm.tsx`**
- Nas duas chamadas de `loginWithGoogle(idToken)` (login normal e pós-vínculo),
  passar `loginWithGoogle(idToken, redirect)`.
- O `formAction` já injeta `redirect` no FormData quando a prop existe — não mexe.

_Commit 1: `fix(login): honra a prop redirect (login e loginWithGoogle)`_

---

## Passo 2 — Server action `criarCodigoDispositivo`

**`app/entrar-dispositivo/actions.ts`** (`'use server'`)

```ts
export async function criarCodigoDispositivo(): Promise<{ code?: string; error?: string }>
```
- `user = await getSessionUser()` (de `@/utils/permissions`); sem sessão → `{ error }`
- `code = randomBytes(32).toString('base64url')`
- `adminDb.collection('device_logins').doc(code).set({ uid, email, createdAt:
  FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() +
  120_000), usedAt: null })`
- limpeza oportunista: query `where('expiresAt', '<', now).limit(20)` → `batch.delete`
  (try/catch, best-effort). Índice: campo único, sem composto.
- retorna `{ code }`

_Commit 2: `feat(desktop): action criarCodigoDispositivo + coleção device_logins`_

---

## Passo 3 — `POST /api/desktop/exchange`

**`app/api/desktop/exchange/route.ts`** — `export const runtime = 'nodejs'`,
`export const dynamic = 'force-dynamic'`. Sem auth.

1. `{ code } = await req.json()`; valida `typeof code === 'string'` e
   `/^[A-Za-z0-9_-]{20,64}$/`
2. rate-limit leve por IP-hash (reusa o padrão de `sha256(ip)` do
   `/api/anuncios`; ex.: 20 req / 5 min). Best-effort.
3. `ref = adminDb.collection('device_logins').doc(code)`
4. `runTransaction`: lê o doc; se `!exists || data.usedAt || nowMs > data.expiresAt.toMillis()`
   → lança erro controlado `INVALIDO`; senão `tx.update(ref, { usedAt: serverTimestamp() })`.
   Retorna `uid`.
5. `profileSnap = await adminDb.collection('profiles').doc(uid).get()` — se
   `!exists` → `403 { error: 'Conta sem acesso liberado.' }` (NÃO deleta o usuário)
6. `customToken = await adminAuth.createCustomToken(uid)`
7. `idToken`:
   ```ts
   const r = await fetch(
     `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
     { method: 'POST', headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ token: customToken, returnSecureToken: true }) },
   )
   ```
   `!r.ok` → `500`
8. `sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: 5*24*3600*1000 })`
9. `const res = NextResponse.json({ ok: true })` +
   `res.cookies.set('session', sessionCookie, { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', sameSite: 'lax', maxAge: 5*24*3600 })`
   (usar `res.cookies` do NextResponse — em route handler o `cookies()` de
   `next/headers` também serve; validar qual grava o header corretamente)
10. erros de código inválido → `400 { error: 'Código expirado ou já usado. Tente entrar de novo.' }`

**Risco a validar na implementação:** `adminAuth.createCustomToken` exige que a
service account tenha permissão de assinar (`iam.serviceAccounts.signBlob`). A SA
gerada pelo Firebase normalmente já tem. Se falhar, o erro é explícito — anotar
no PR e o Gustavo libera a role no IAM.

_Commit 3: `feat(desktop): rota POST /api/desktop/exchange (code -> cookie de sessão)`_

---

## Passo 4 — Página `/entrar-dispositivo`

**`app/entrar-dispositivo/page.tsx`** (server component)
- `searchParams`: `porta`, `state`. Valida `porta` = inteiro em `[1024, 65535]`,
  `state` = string não-vazia (`[A-Za-z0-9]{8,64}`). Inválido → renderiza
  `<ErroDispositivo />` ("Abra esta página pelo app Liberty Car.").
- `user = await getSessionUser()`.
- `user` nulo → `<LoginForm redirect={\`/entrar-dispositivo?porta=${porta}&state=${state}\`} />`
  (reusa o componente inteiro; sem `<PublicHeader>`, layout enxuto tipo
  `app/login/page.tsx`).
- `user` presente → `<ConsentimentoDispositivo porta={porta} state={state} email={user.email} />`.
- `export const metadata` (noindex — `robots: { index: false }`).

**`app/entrar-dispositivo/ConsentimentoDispositivo.tsx`** (client)
- Card: "Entrar no app Liberty Car como **{email}**?"
- `[Autorizar]` → `startTransition(async () => { const r = await criarCodigoDispositivo();
  if (r.code) window.location.href = \`http://127.0.0.1:${porta}/callback?code=${encodeURIComponent(r.code)}&state=${encodeURIComponent(state)}\`
  else toast.error(...) })`.
  - `porta` já validada no server; ainda assim, montar a URL só com
    `http://127.0.0.1:${Number(porta)}/...`.
- `[Não sou eu / trocar de conta]` → `await logout()` (de `app/login/actions.ts`)
  → recarrega (`router.refresh()` não basta pós-logout; usar
  `window.location.reload()`).
- Depois do redirect, mostra "Pode voltar para o app Liberty Car." (caso o
  navegador não feche a aba sozinho).

_Commit 4: `feat(desktop): página /entrar-dispositivo (login + consentimento)`_

---

## Passo 5 — Electron: fluxo loopback

**`desktop/src/device-login.ts`** (novo)

```ts
import * as http from 'node:http'
import { randomBytes } from 'node:crypto'
import { shell, net, BrowserWindow } from 'electron'
import { APP_ORIGIN, APP_URL } from './config'

let emAndamento: http.Server | null = null

export function loginWithBrowser(getWindow: () => BrowserWindow | null): Promise<void> {
  return new Promise((resolve, reject) => {
    emAndamento?.close()
    const state = randomBytes(16).toString('hex')
    const server = http.createServer((req, res) => { /* ver abaixo */ })
    emAndamento = server
    const cleanup = () => { clearTimeout(timer); server.close(); emAndamento = null }
    const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')) }, 180_000)

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const porta = typeof addr === 'object' && addr ? addr.port : 0
      if (!porta) { cleanup(); return reject(new Error('sem porta')) }
      shell.openExternal(`${APP_ORIGIN}/entrar-dispositivo?porta=${porta}&state=${state}`)
    })

    // handler:
    //  - parse URL; só aceita GET /callback
    //  - se query.state !== state → 400 "requisição inválida", NÃO resolve
    //  - responde 200 text/html "Login concluído — pode fechar esta aba"
    //  - cleanup()
    //  - troca o code:
    //      const r = await net.fetch(`${APP_ORIGIN}/api/desktop/exchange`, {
    //        method: 'POST', headers: { 'content-type': 'application/json' },
    //        body: JSON.stringify({ code: query.code }),
    //      })
    //      if (!r.ok) return reject(new Error((await r.json()).error ?? 'falha'))
    //  - garante o cookie na sessão (ver nota) → getWindow()?.loadURL(APP_URL) → resolve()
  })
}
```

**Cookie na sessão do Electron** — validar na implementação, nesta ordem:
1. `net.fetch` já usa `session.defaultSession`; se o `Set-Cookie` da resposta cair
   sozinho na cookie jar, nada a fazer.
2. Se não cair: ler `r.headers.get('set-cookie')`, extrair o valor de `session=…`
   e `await session.defaultSession.cookies.set({ url: APP_ORIGIN, name: 'session',
   value, httpOnly: true, secure: APP_ORIGIN.startsWith('https'), path: '/',
   sameSite: 'lax', expirationDate: Date.now()/1000 + 5*24*3600 })`.

**`desktop/src/main.ts`**
- `import { loginWithBrowser } from './device-login'`
- em `app.whenReady()` (ou junto dos outros `ipcMain`):
  `ipcMain.handle('login-with-browser', () => loginWithBrowser(getWindow))`

**`desktop/src/preload.ts`**
```ts
contextBridge.exposeInMainWorld('libertyDesktop', {
  retry: () => ipcRenderer.send('retry-load'),
  appVersion: () => ipcRenderer.invoke('app-version') as Promise<string>,
  loginWithBrowser: () => ipcRenderer.invoke('login-with-browser') as Promise<void>,
})
```

_Commit 5: `feat(desktop): fluxo de login via navegador (loopback + IPC)`_

---

## Passo 6 — `LoginForm` ramo desktop

**`app/login/LoginForm.tsx`**
- Tipo de `window.libertyDesktop`: adicionar `loginWithBrowser?: () => Promise<void>`.
- `useIsDesktopApp()` continua.
- Quando `isDesktopApp`:
  - Botão primário `Button` grande **"Entrar com o navegador"** (ícone
    `IconWorld` ou `GoogleIcon`), `onClick` →
    ```ts
    startBrowserLoginTransition(async () => {
      try { await window.libertyDesktop!.loginWithBrowser() /* o Electron navega */ }
      catch { toast.error('Login não concluído. Tente de novo.', 'Falha') }
    })
    ```
    Pendente: texto "Abrindo o navegador… conclua o login lá e volte."
  - `<details>` "ou entrar com e-mail e senha" englobando o `<form>` atual.
  - **Não** renderiza o botão do Google (segue escondido no desktop).
- Quando `!isDesktopApp`: **markup atual intacto** (Google + e-mail/senha).
- Cuidar do caso `window.libertyDesktop` existir mas sem `loginWithBrowser`
  (app antigo): se `!loginWithBrowser`, cai no comportamento atual (só
  e-mail/senha, sem o botão novo).

_Commit 6: `feat(login): botão "Entrar com o navegador" no app desktop`_

---

## Passo 7 — Limpeza da infra do popup abandonado

**`desktop/src/main.ts`**
- Remove o bloco que limpa o User-Agent (`session.defaultSession.setUserAgent(cleanUA)`
  e o comentário).
- `setWindowOpenHandler`: remove o ramo especial que abre `AUTH_ORIGINS` como
  janela-filha; mantém só: mesma origem (`APP_ORIGINS`) → `allow`; resto →
  `shell.openExternal` + `deny`.
- `will-navigate` / `will-redirect` / `isAllowedNavigation`: tirar `AUTH_ORIGINS`
  da condição (nada de auth navega dentro do app agora).

**`desktop/src/config.ts`**
- Remove `AUTH_ORIGINS` e o comentário. Ajusta `isAllowedNavigation` /
  `hardenContents` que a referenciam.

**`desktop/README.md`**
- Reescreve a seção "Login": "Google e e-mail/senha. O 'Entrar com o navegador'
  abre o navegador do sistema, você loga lá (Google inclusive) e volta pro app
  já logado; a sessão dura 5 dias. E-mail/senha também funciona direto no app."

_Commit 7: `chore(desktop): remove infra do signInWithPopup abandonado`_

---

## Passo 8 — Verificação

**Automático:** `npx tsc --noEmit` · `npm run build` (raiz) ·
`cd desktop && npm run compile` · `eslint` sem regressão.

**Manual (testes do spec):**
1. `npm run dev` (raiz) + `cd desktop && npm run dev`. App sem sessão → "Entrar
   com o navegador" → navegador abre em `/entrar-dispositivo` → login Google →
   volta pro app em `/dashboard`.
2. Já logado no site no navegador → só o card de consentimento → `[Autorizar]`.
3. `<details>` e-mail/senha no app → funciona.
4. Vincular conta pelo navegador (e-mail com senha, sem Google) → funciona.
5. Fechar o navegador no meio → após 3 min: toast "Login não concluído".
6. Repetir `POST /api/desktop/exchange` com o mesmo `code` → `400`.
7. Adulterar `state` no `/callback` → app ignora, não resolve.
8. Fechar/reabrir o app → sessão persiste.
9. `[Não sou eu]` no navegador → volta pro `<LoginForm>`.
10. `cd desktop && npm run build` → instala o `.exe` → repete o teste 1 no
    empacotado (aí `APP_ORIGIN` é o domínio real; precisa do site em produção
    com esta branch — ou testar só em dev e anotar).

Parar antes do merge. PR só com "ok".

---

## Sequência de commits (branch `feat/desktop-login-google`)

1. `fix(login): honra a prop redirect (login e loginWithGoogle)`
2. `feat(desktop): action criarCodigoDispositivo + coleção device_logins`
3. `feat(desktop): rota POST /api/desktop/exchange (code -> cookie de sessão)`
4. `feat(desktop): página /entrar-dispositivo (login + consentimento)`
5. `feat(desktop): fluxo de login via navegador (loopback + IPC)`
6. `feat(login): botão "Entrar com o navegador" no app desktop`
7. `chore(desktop): remove infra do signInWithPopup abandonado`

(commit 0 `docs` do spec já está na branch.)

---

## Pendências / o que depende de você

- **`createCustomToken`**: se a service account do Firebase não puder assinar, o
  passo 3 falha com erro claro — aí precisa liberar "Service Account Token
  Creator" no IAM do projeto (Console). Só descobrimos ao rodar.
- **Teste no `.exe` empacotado** de verdade exige o site em produção já com esta
  branch (o `APP_ORIGIN` de prod é fixo). O grosso dá pra validar em dev.
- Decidir se `device_logins` ganha TTL policy no Firestore (Console) ou fica só
  com a limpeza oportunista do código (plano assume: oportunista).
