# Plano de implementação — Analytics de visitantes

**Spec:** `docs/superpowers/specs/2026-09-10-analytics-visitantes-design.md`
**Branch:** `feat/analytics-visitantes`
**Data:** 2026-09-10

Verificação global: `npm run build` limpo · `npm run lint` limpo · testes manuais
1–11 do spec. **Sem merge na master sem "ok".**

Antes de escrever qualquer código: ler em `node_modules/next/dist/docs/` os guias
de **`proxy.ts`** (já lido: runtime Node, `response.cookies.set`), **Route
Handlers** (`route.ts`, `cookies()` de `next/headers` dentro de route handler,
`runtime`) e **App Router** (`usePathname`, efeitos em navegação client-side) — o
projeto roda Next.js 16 com breaking changes (AGENTS.md). Anotar no PR qualquer
divergência.

Convenções já existentes que este plano segue:
- Firestore via `@/utils/firebase/admin` (`adminDb`); `FieldValue.increment`,
  `runTransaction`, `Timestamp` via `firebase-admin/firestore`.
- Route handler: `export const runtime = 'nodejs'` + `export const dynamic =
  'force-dynamic'` (ver `app/api/anuncios/route.ts`, `app/api/desktop/exchange/route.ts`).
- `getClientIp` / headers de proxy: `@/utils/get-client-ip`.
- Gate de página: `getSessionUser` + `hasPageAccess` (`@/utils/permissions`).
- Cartões de métrica: markup inline no padrão de
  `app/dashboard/financeiro/FinanceiroClient.tsx` (linhas ~432-465) — sem
  componente `StatCard` (não existe).
- Nav: `NAV_ITEMS` + `NavIcon` em `app/components/DashboardShell.tsx`
  (`icon` é union de strings; adicionar `'chart'`).
- Toggle de permissão: `PERMISSION_TABS` em
  `app/dashboard/usuarios/UserManagementClient.tsx`.
- `proxy.ts` na raiz chama `updateSession(request)` no fim e tem `config.matcher`
  cobrindo o site + `/api`.

---

## Passo 1 — Módulos puros: bots e datas

**`utils/analytics/bots.ts`** (novo, sem `server-only` — usado no `proxy` e no route handler)
```ts
const BOT_RE =
  /bot|crawl|spider|slurp|mediapartners|adsbot|bingpreview|facebookexternalhit|facebot|embedly|quora link preview|whatsapp|telegrambot|discordbot|slackbot|linkedinbot|pinterest|redditbot|twitterbot|applebot|petalbot|yandex|duckduckbot|baiduspider|semrushbot|ahrefsbot|mj12bot|dotbot|dataforseo|headlesschrome|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|python-requests|curl\/|wget|axios|go-http-client|node-fetch/i

/** Sem user-agent também é tratado como bot (não conta como visitante). */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true
  return BOT_RE.test(ua)
}
```

**`utils/analytics/dates.ts`** (novo, sem `server-only`)
```ts
const TZ = 'America/Sao_Paulo'

/** "2026-09-10" no fuso de São Paulo (servidor roda em UTC). */
export function dayKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d) // en-CA => YYYY-MM-DD
}

/** "2026-09" no fuso de São Paulo. */
export function monthKey(d: Date = new Date()): string {
  return dayKey(d).slice(0, 7)
}
```

_Commit 1: `feat(analytics): helpers de detecção de bot e datas em SP`_

---

## Passo 2 — Cookie de identidade no `proxy.ts`

**`proxy.ts`** — editar a função `proxy()`:
- Novo import: `import { randomUUID } from 'node:crypto'` e
  `import { isBotUserAgent } from '@/utils/analytics/bots'`.
- Trocar `return await updateSession(request)` por:
  ```ts
  const response = await updateSession(request)
  if (
    !request.cookies.get('liberty_vid') &&
    !isBotUserAgent(request.headers.get('user-agent'))
  ) {
    response.cookies.set('liberty_vid', randomUUID(), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  }
  return response
  ```
- `updateSession` já devolve um `NextResponse` (`.next()` ou `.redirect()`); setar
  cookie em qualquer um é seguro. Não mexer no resto do `proxy()` (rate limit etc.).

Verificar: `config.matcher` atual exclui imagens e `_next/static` — cobre as
páginas HTML do site, que é o que precisa setar o cookie. Ok, não alterar.

_Commit 2: `feat(analytics): cookie liberty_vid (UUID) no proxy, pulando bots`_

---

## Passo 3 — Ingestão: `POST /api/track`

**`app/api/track/route.ts`** (novo)
```ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
```
Imports: `cookies` de `next/headers`; `adminAuth`, `adminDb` de
`@/utils/firebase/admin`; `FieldValue`, `Timestamp` de `firebase-admin/firestore`;
`isBotUserAgent`; `dayKey`, `monthKey`.

Constantes:
```ts
const IGNORAR_PREFIXOS = ['/dashboard', '/login', '/entrar-dispositivo', '/api']
const DIA_MS = 24 * 60 * 60 * 1000
const TTL_DIA_DIAS = 60
const TTL_MES_DIAS = 400
const VEICULO_RE = /^\/veiculos\/([^/?#]+)\/?$/
```

`export async function POST(req: Request)` — corpo inteiro num `try`; `catch` →
`console.error('[track]', e)` + `noContent()`. Helper
`const noContent = () => new Response(null, { status: 204 })`.

Fluxo:
1. `const body = await req.json().catch(() => null)`.
   `let path = typeof body?.path === 'string' ? body.path : ''`.
   Se `!path.startsWith('/') || path.length > 512` → `noContent()`.
2. `path = path.split('?')[0].split('#')[0]`.
3. Se `IGNORAR_PREFIXOS.some(p => path === p || path.startsWith(p + '/'))` →
   `noContent()`.
4. `if (isBotUserAgent(req.headers.get('user-agent'))) return noContent()`.
5. `const jar = await cookies()`.
   `const vid = jar.get('liberty_vid')?.value`. Se `!vid` → `noContent()`.
   Validar formato UUID (`/^[0-9a-f-]{36}$/i`); senão `noContent()`.
6. `logged`:
   ```ts
   let logged = false
   const session = jar.get('session')?.value
   if (session) {
     try { await adminAuth.verifySessionCookie(session); logged = true }
     catch { logged = false }
   }
   ```
   (sem `checkRevoked` — só validação local, mesmo critério de `updateSession`).
7. `const now = Timestamp.now()`, `const day = dayKey()`, `const month = monthKey()`.
8. `await registrarVisita({ day, month, vid, logged, now })` (helper abaixo).
9. `const m = path.match(VEICULO_RE)`; se `m` →
   ```ts
   await adminDb.collection('analytics_vehicle_daily').doc(day).set({
     date: day,
     views: { [m[1]]: FieldValue.increment(1) },
     updatedAt: now,
   }, { merge: true })
   ```
10. `return noContent()`.

**`registrarVisita`** — uma transação:
```ts
async function registrarVisita({ day, month, vid, logged, now }) {
  const dailyRef   = adminDb.collection('analytics_daily').doc(day)
  const monthlyRef = adminDb.collection('analytics_monthly').doc(month)
  const dailyMarker   = dailyRef.collection('visitors').doc(vid)
  const monthlyMarker = monthlyRef.collection('visitors').doc(vid)

  await adminDb.runTransaction(async (tx) => {
    const [dm, mm] = await Promise.all([tx.get(dailyMarker), tx.get(monthlyMarker)])

    aplicar(tx, dailyRef, dailyMarker, dm, day, logged, now, TTL_DIA_DIAS)
    aplicar(tx, monthlyRef, monthlyMarker, mm, month, logged, now, TTL_MES_DIAS)
  })
}

function aplicar(tx, aggRef, markerRef, snap, dateStr, logged, now, ttlDias) {
  const novo = !snap.exists
  const precisaLogado = logged && (novo || snap.get('logged') !== true)

  tx.set(aggRef, {
    date: dateStr,
    pageviews: FieldValue.increment(1),
    uniqueVisitors: FieldValue.increment(novo ? 1 : 0),
    loggedVisitors: FieldValue.increment(precisaLogado ? 1 : 0),
    updatedAt: now,
  }, { merge: true })

  if (novo) {
    tx.set(markerRef, {
      firstSeen: now,
      logged,
      expiresAt: Timestamp.fromMillis(now.toMillis() + ttlDias * DIA_MS),
    })
  } else if (precisaLogado) {
    tx.update(markerRef, { logged: true })
  }
}
```
(Transação: todos os `get` antes de qualquer `set`/`update` — ok acima.)

Rate limit: já coberto pelo `rateLimit('global:${ip}', 200, 60s)` do `proxy.ts`
(matcher pega `/api`). Nada a adicionar.

_Commit 3: `feat(analytics): endpoint POST /api/track (agrega visitas no Firestore)`_

---

## Passo 4 — Coletor no cliente

**`app/components/Analytics.tsx`** (novo, `'use client'`)
```tsx
'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const IGNORAR = ['/dashboard', '/login', '/entrar-dispositivo']

export default function Analytics() {
  const pathname = usePathname()
  const ultimoEnviado = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return
    if (IGNORAR.some((p) => pathname === p || pathname.startsWith(p + '/'))) return
    if (ultimoEnviado.current === pathname) return
    ultimoEnviado.current = pathname

    try {
      fetch('/api/track', {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: pathname }),
      }).catch(() => {})
    } catch { /* nunca quebra navegação */ }
  }, [pathname])

  return null
}
```

**`app/layout.tsx`** — importar e montar `<Analytics />` dentro do `<body>`,
como irmão de `<PublicLayoutWrapper>` (dentro de `DashboardThemeProvider` tudo
bem; ele não depende de tema). Ex.: logo após `<RouteLoadingBar />`.

_Commit 4: `feat(analytics): componente <Analytics/> que pinga /api/track por rota`_

---

## Passo 5 — Permissão e navegação

**`utils/permissions.ts`**
- `UserPermissions` += `analytics?: boolean`.
- Nada de `assert*` novo — a página usa `hasPageAccess(user, 'analytics', ['admin'])`.

**`app/components/DashboardShell.tsx`**
- `NavItem['icon']` union += `'chart'`.
- Import `IconChartBar` de `@tabler/icons-react`.
- `NavIcon`: `case 'chart': return <IconChartBar ... />` (mesmas props/tamanho dos outros).
- `NAV_ITEMS`: adicionar (perto de "Novidades"/"Feedback", ou após "Usuários")
  ```ts
  { href: '/dashboard/analytics', label: 'Visitantes', icon: 'chart',
    roles: ['admin'], permissionKey: 'analytics' },
  ```

**`app/dashboard/usuarios/UserManagementClient.tsx`**
- `PERMISSION_TABS` += `{ key: 'analytics', label: 'Visitantes', defaultRoles: ['admin'] }`.

**`app/dashboard/page.tsx`**
- Import `IconChartBar`.
- `MODULES` += `{ href: '/dashboard/analytics', titulo: 'Visitantes do site',
  descricao: 'Quantas pessoas acessam o site, quantas estão logadas e os veículos
  mais vistos.', icon: IconChartBar, badge: 'Admin', allowed: ['admin'] }`.

_Commit 5: `feat(analytics): permissão "analytics", item de menu e card no dashboard`_

---

## Passo 6 — Leitura dos dados (server)

**`app/dashboard/analytics/data.ts`** (novo, sem `'use server'` — funções de
leitura chamadas pelo server component; se preferir, inline no `page.tsx`)

Tipos:
```ts
export interface DiaSerie { date: string; uniqueVisitors: number; loggedVisitors: number; pageviews: number }
export interface VeiculoTop { id: string; nome: string; views: number; existe: boolean }
export interface AnalyticsOverview {
  hoje: { uniqueVisitors: number; loggedVisitors: number; pageviews: number }
  mes:  { uniqueVisitors: number; loggedVisitors: number; pageviews: number; label: string }
  serie30: DiaSerie[]      // ordem ASC por data
  topVeiculos: VeiculoTop[] // até 10, desc por views
  erro: boolean
}
```

`getAnalyticsOverview(): Promise<AnalyticsOverview>` — try/catch geral →
em erro devolve zeros + `erro: true`:
1. `serie30`: `adminDb.collection('analytics_daily').orderBy('date', 'desc').limit(30).get()`
   → mapear para `DiaSerie` (campos ausentes → 0), depois `.reverse()` (ASC).
2. `hoje`: item de `serie30` com `date === dayKey()`, ou zeros.
3. `mes`: `adminDb.collection('analytics_monthly').doc(monthKey()).get()` →
   campos ou zeros. `label` = mês por extenso (`Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })` sobre `new Date(monthKey()+'-01T12:00:00Z')`).
4. `topVeiculos`:
   - `adminDb.collection('analytics_vehicle_daily').orderBy('date','desc').limit(30).get()`.
   - Somar `views` (map) por id num `Map<string, number>`.
   - Ordenar desc, pegar top 10 ids.
   - Buscar nomes: `adminDb.getAll(...ids.map(id => adminDb.collection('veiculos').doc(id)))`.
     Para cada: existe → `nome = \`${marca} ${modelo} ${ano}\`.trim()`, `existe: true`;
     não existe → `nome = 'Veículo removido'`, `existe: false`.
   - Montar `VeiculoTop[]` preservando a ordem de views.

**`app/dashboard/analytics/page.tsx`** (novo, server component)
```tsx
export const metadata = { title: 'Visitantes | Liberty Car' }

export default async function AnalyticsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!hasPageAccess(user, 'analytics', ['admin'])) redirect('/dashboard?error=acesso_negado')
  const dados = await getAnalyticsOverview()
  return <AnalyticsView dados={dados} />
}
```

**`app/dashboard/analytics/loading.tsx`** (novo) — Skeleton no padrão das outras
abas (blocos de cartão + retângulo do gráfico + linhas da tabela).

_Commit 6: `feat(analytics): leitura agregada (hoje, mês, série 30d, top veículos)`_

---

## Passo 7 — UI da aba

**`app/dashboard/analytics/AnalyticsView.tsx`** (novo)
- Pode ser server component (recebe `dados`); só o gráfico é client.
- **Cabeçalho**: título "Visitantes do site" + subtítulo curto explicando que
  "visitante" = navegador/dispositivo único (cookie), não conta a navegação
  interna do painel.
- Se `dados.erro` → faixa discreta "Não foi possível carregar os dados agora."
  (continua renderizando zeros).
- **Cartões** (`grid gap-4 sm:grid-cols-2 lg:grid-cols-4`, markup inline no
  padrão do `FinanceiroClient`):
  1. "Visitantes hoje" → `hoje.uniqueVisitors`; rodapé
     `{hoje.loggedVisitors} logados · {hoje.uniqueVisitors - hoje.loggedVisitors} anônimos`.
  2. "Visitantes em {mes.label}" → `mes.uniqueVisitors`; mesmo rodapé com dados do mês.
  3. "Pageviews hoje" → `hoje.pageviews`.
  4. "Pageviews no mês" → `mes.pageviews`.
  Ícones: `IconUsers`, `IconUserCheck`, `IconEye`, `IconEye` (ou similar do Tabler).
- **Gráfico**: `<VisitorsChart serie={dados.serie30} />` dentro de um card
  "Visitantes únicos por dia — últimos 30 dias", com legenda "total" / "logados"
  e a nota "somar as barras não dá o total do mês (quem volta em dias diferentes
  conta em cada dia)".
- **Tabela "Veículos mais vistos (últimos 30 dias)"** (`Table` de
  `@/app/components/ui` ou markup simples):
  - colunas: `#`, Veículo, Visualizações.
  - `existe` → nome com `Link href={\`/dashboard/veiculos?veiculoId=${id}\`}`;
    senão texto plano + `id` em `text-neutral-400`.
  - vazio → `EmptyState` "Ainda sem visualizações registradas".

**`app/dashboard/analytics/VisitorsChart.tsx`** (novo, `'use client'`) — **SVG à
mão, sem dependência nova**:
- Props: `serie: DiaSerie[]` (ASC).
- `viewBox="0 0 720 240"`, `preserveAspectRatio="none"` no path / `xMidYMid` no
  wrapper; `width: 100%`, altura fixa via CSS.
- Escala Y: `max(1, ...uniqueVisitors)`. X: índice → largura.
- Duas `<polyline>`: total (cor `--color-liberty` / `text-liberty`) e logados
  (cor neutra/emerald). Pontos `<circle>` pequenos.
- Eixo X: rótulo a cada ~5 dias (`dd/MM`); linha de base.
- Hover: `<rect>` invisível por dia captura `onMouseEnter` → estado com
  `{ date, unique, logged }` → tooltip absoluto (div) acima do gráfico.
- Cores só via classes Tailwind / tokens já usados no dashboard (suporte a
  `adobe-dark`).
- Sem dados (`serie` vazia ou tudo 0) → placeholder "Sem dados ainda".

_Commit 7: `feat(analytics): aba /dashboard/analytics (cartões, gráfico SVG, top veículos)`_

---

## Passo 8 — Verificação final

Rodar os **testes manuais 1–11 do spec**:
1. Cookie `liberty_vid` setado na 1ª visita (HttpOnly/Secure/~1 ano); não re-seta.
2. Bot (`curl -A Googlebot`) → sem cookie; `/api/track` com UA de bot → 204, nada gravado.
3. Pageview anônimo em `/` e `/veiculos` → `analytics_daily/{hoje}` `uniqueVisitors:1`,
   `loggedVisitors:0`, `pageviews:2`; markers dia+mês; `analytics_monthly/{mês}` `uniqueVisitors:1`.
4. Recarregar `/` 3× → `pageviews` sobe, `uniqueVisitors` fica 1.
5. Logar no painel + abrir o site → `loggedVisitors` do dia e do mês vai a 1 para
   aquele `vid` (marker atualizado uma vez só).
6. Navegar dentro de `/dashboard` e `/login` → nenhum incremento em `analytics_*`.
7. `/veiculos/{A}` 5× e `/veiculos/{B}` 2× → `analytics_vehicle_daily/{hoje}.views`
   = `{A:5,B:2}`; aba lista A antes de B com nome certo; apagar B → "Veículo removido".
8. `/dashboard/analytics`: admin vê cartões + gráfico + tabela; `vendedor` sem a
   permissão é redirecionado e não vê o item no menu.
9. Simular erro do Firebase Admin → `/api/track` responde 204, site não quebra,
   console do navegador limpo.
10. Em dev (Strict Mode) uma navegação → **um** POST `/api/track`.
11. `npm run build` limpo; `npm run lint` limpo.

Depois: parar. Abrir PR só com "ok" do Gustavo.

---

## Sequência de commits (branch `feat/analytics-visitantes`)

1 spec commit (`b106828`) já está na branch.

1. `feat(analytics): helpers de detecção de bot e datas em SP`
2. `feat(analytics): cookie liberty_vid (UUID) no proxy, pulando bots`
3. `feat(analytics): endpoint POST /api/track (agrega visitas no Firestore)`
4. `feat(analytics): componente <Analytics/> que pinga /api/track por rota`
5. `feat(analytics): permissão "analytics", item de menu e card no dashboard`
6. `feat(analytics): leitura agregada (hoje, mês, série 30d, top veículos)`
7. `feat(analytics): aba /dashboard/analytics (cartões, gráfico SVG, top veículos)`

---

## Pendências / decisões que dependem de você

- **Política de TTL do Firestore** (manual, no console GCP/Firebase): criar TTL
  no campo `expiresAt` para o **collection group** `visitors`, para os markers
  não acumularem para sempre. Não é automatizável por código; enquanto não
  existir, o único efeito é um pouco de storage extra. **Não bloqueia o deploy.**
- **`firestore.rules`**: as coleções `analytics_*` só são lidas/escritas pelo
  Admin SDK (servidor) — o SDK ignora as rules. Não é preciso liberar nada para
  o cliente. Confirmar que não há uma regra `allow read` ampla que exponha
  `analytics_*` a clientes autenticados; se houver um catch-all, adicionar
  `match /analytics_daily/{d}/{document=**} { allow read, write: if false }` etc.
- **Consentimento de cookie / LGPD**: fora de escopo nesta entrega (decisão do
  dono). O cookie é first-party, sem PII; pode-se adicionar banner depois sem
  tocar no modelo de dados.
- **Contagem de "logados"**: é nº de navegadores/dispositivos com sessão válida,
  não nº de contas distintas. Confirmar que essa é a leitura desejada para o
  rótulo na UI.
