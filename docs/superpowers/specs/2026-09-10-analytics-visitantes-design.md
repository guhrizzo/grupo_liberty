# Analytics de visitantes — quantas pessoas (IDs) acessam o site

**Data:** 2026-09-10
**Status:** rascunho (aguardando revisão do spec)
**Branch:** `feat/analytics-visitantes`
**Relacionado:** [`proxy.ts`](../../../proxy.ts), [`utils/firebase/admin.ts`](../../../utils/firebase/admin.ts), coleção `veiculos`

## Problema / objetivo

Hoje não há como saber quantas pessoas acessam o site público. O pedido: um
contador de **visitantes únicos** ("IDs" = pessoas distintas), separando quem
está **logado** de quem é **anônimo**, visível numa aba do dashboard, com
tendência ao longo do tempo e a lista dos **veículos mais vistos**.

Decisões de produto já tomadas (brainstorm 2026-09-10):

- "Pessoa/ID" = **visitante anônimo único** (cookie no navegador) **+** recorte
  de quantos desses estão **logados** (opção C do brainstorm). Quem limpa cookie
  ou troca de aparelho conta como outra pessoa — limitação aceita.
- Dashboard mostra: **números + gráfico de tendência + veículos mais vistos**.
- **Histórico diário guardado para sempre** (agregados). Períodos exibidos:
  hoje, mês atual, e gráfico dos últimos 30 dias.
- **Bots são filtrados** (Googlebot, WhatsApp, crawlers) para não inflar.
- **Navegação interna do `/dashboard` NÃO conta** — é a equipe, distorceria o
  número de "visitantes logados". `/login` e `/entrar-dispositivo` também não
  contam.
- Solução **first-party** (dados na base do projeto, no Firestore) — nada de
  Google Analytics / Vercel Analytics / Plausible.

## Não-objetivos (nesta entrega)

- Banner / gerenciador de consentimento de cookies (ver "Segurança / privacidade").
- Origem geográfica, dispositivo, navegador, referrer, campanhas/UTM.
- Funil de conversão (visita → proposta), tempo na página, scroll, cliques.
- Visitantes únicos "reais" cruzando vários meses (o recorte é dia e mês).
- Exportação CSV / relatórios agendados.
- Painel em tempo real ("ao vivo").
- Retenção automática dos agregados (nunca são apagados nesta versão).

## Arquitetura escolhida (Abordagem 1 do brainstorm)

Tracking próprio: cookie de identidade no `proxy.ts` + ping do cliente a cada
navegação + agregação no Firestore via route handler + leitura no dashboard.

```
Navegador                          proxy.ts (Node runtime)          app/api/track (Node)         Firestore
─────────                          ───────────────────────          ────────────────────         ─────────
carrega qualquer página  ────────► se não tem cookie liberty_vid    —                            —
                                   e não é bot → Set-Cookie
                                   liberty_vid=<uuid> (1 ano)

<Analytics/> (client, na raiz)
  a cada mudança de rota pública ──────────────────────────────────► POST { path }
  (fetch keepalive)                                                   ├─ lê cookie liberty_vid → sem cookie: 204
                                                                      ├─ user-agent é bot? → 204
                                                                      ├─ path interno (/dashboard, /login,
                                                                      │   /entrar-dispositivo, /api)? → 204
                                                                      ├─ lê cookie `session` → verifica
                                                                      │   (verifySessionCookie, sem checkRevoked)
                                                                      │   → logged = true/false
                                                                      ├─ transação: marcador do visitante
                                                                      │   (dia + mês) + incrementos            ──► analytics_daily/{dia}
                                                                      └─ path /veiculos/{id}? → +1 view         ──► analytics_monthly/{mês}
                                                                                                                    analytics_vehicle_daily/{dia}

/dashboard/analytics (server component, admin)  ◄────── lê agregados ──────────────────────────────────────────────
```

### Por que não as alternativas

- **Vercel Web Analytics / Plausible / GA**: não separa logado de anônimo com o
  conceito de "ID" do projeto, dado fica em terceiro, "veículos mais vistos"
  vira URL crua sem o nome do carro. Não atende o pedido.
- **Tracking direto no `proxy.ts`** (sem route handler): o `proxy` roda em Node
  no Next 16, mas a doc oficial avisa que ele "pode ser implantado no CDN" e
  **não deve depender de módulos compartilhados/globais** — `firebase-admin` ali
  é frágil. Route handler dedicado é o lugar certo para escrever no Firestore.
- **Middleware gravando evento cru + cron agregando**: mais infra e mais custo
  de storage (um doc por pageview), sem ganho para o que foi pedido.

## Identificação do visitante — cookie `liberty_vid`

- Setado em [`proxy.ts`](../../../proxy.ts), dentro da função `proxy()` já
  existente, **antes** do `return await updateSession(request)`.
- Regras:
  - Só age quando `request.cookies.get('liberty_vid')` **não existe**.
  - Se o `user-agent` casa com a regex de bot (`utils/analytics/bots.ts`) →
    **não seta** (bot não vira "visitante").
  - Gera `crypto.randomUUID()` (disponível no runtime Node do proxy).
  - `response.cookies.set('liberty_vid', uuid, { httpOnly: true, secure: true,
    sameSite: 'lax', path: '/', maxAge: 60*60*24*365 })`.
  - `response` = o `NextResponse` retornado por `updateSession(request)`. Para
    não reescrever o fluxo do `updateSession` (que às vezes retorna
    `NextResponse.redirect`), o cookie é aplicado ao objeto retornado por ele
    (setar cookie num redirect é inofensivo e raro nesse caminho, já que o
    matcher cobre o site público inteiro).
- `httpOnly` de propósito: o valor nunca precisa ser lido por JS no cliente
  (quem decide "logado" é o servidor). Reduz superfície a XSS.
- **Não** é PII: UUID aleatório, sem ligação com identidade, e-mail ou IP.

### `utils/analytics/bots.ts` (novo)

Módulo puro, sem `server-only` (usado no `proxy` e no route handler):

```ts
const BOT_RE = /bot|crawl|spider|slurp|mediapartners|adsbot|bingpreview|
  facebookexternalhit|facebot|embedly|quora link preview|whatsapp|telegrambot|
  discordbot|slackbot|linkedinbot|pinterest|redditbot|twitterbot|applebot|
  petalbot|yandex|duckduckbot|baiduspider|semrushbot|ahrefsbot|mj12bot|dotbot|
  dataforseo|headlesschrome|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|
  statuscake|python-requests|curl|wget|axios|go-http-client|node-fetch/i
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true // sem UA → trata como bot (não conta)
  return BOT_RE.test(ua)
}
```

(A regex acima é ilustrativa; no código vai em uma linha só / sem quebras.)

### `utils/analytics/dates.ts` (novo)

Helpers de data no fuso **America/Sao_Paulo** (o servidor roda em UTC):

```ts
export function dayKey(d = new Date()): string   // "2026-09-10"
export function monthKey(d = new Date()): string // "2026-09"
```

Implementação com `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', ... })`.

## Coleta — `<Analytics />` (client)

- Novo `app/components/Analytics.tsx`, `'use client'`.
- Montado no [`app/layout.tsx`](../../../app/layout.tsx), dentro dos providers
  (irmão de `PublicLayoutWrapper`), para rodar em qualquer página.
- Lógica:
  - `const pathname = usePathname()`.
  - `useEffect(() => { ... }, [pathname])`.
  - **Filtro no cliente** (evita request à toa): se `pathname` começa com
    `/dashboard`, `/login`, `/entrar-dispositivo` → não faz nada.
  - Dedupe: `useRef` guarda o último path enviado; ignora repetição (Strict Mode
    / re-render dispara o efeito 2×).
  - `fetch('/api/track', { method: 'POST', keepalive: true, headers:
    { 'content-type': 'application/json' }, body: JSON.stringify({ path: pathname }) })`
    dentro de try/catch vazio (nunca quebra navegação; sem retry).
  - Não renderiza nada (`return null`).
- **Não** usa Firebase Auth no cliente (o projeto não tem
  `onAuthStateChanged` em lugar nenhum e não há contexto de auth público). Quem
  determina "logado" é o `/api/track` pelo cookie `session`.

## Ingestão — `app/api/track/route.ts` (novo)

- `export const runtime = 'nodejs'` (explícito; `firebase-admin` exige).
- `export async function POST(req: Request)`.
- Fluxo (tudo dentro de um `try` externo; qualquer erro → `console.error` +
  `return new Response(null, { status: 204 })`, **nunca** 5xx, **nunca** propaga):
  1. `const { path } = await req.json()`. Valida: `typeof path === 'string'`,
     começa com `/`, `path.length <= 512`. Inválido → 204.
  2. Normaliza `path` removendo query/hash (`path.split('?')[0].split('#')[0]`).
  3. Se `path` começa com `/dashboard`, `/login`, `/entrar-dispositivo`, `/api`
     → 204 (defesa em profundidade; o cliente já filtra).
  4. `isBotUserAgent(req.headers.get('user-agent'))` → 204.
  5. `const vid = (await cookies()).get('liberty_vid')?.value`. Sem `vid` → 204.
     (Primeira visita: o cookie foi setado na resposta do documento; o ping
     seguinte já o envia. Um eventual primeiro ping sem cookie é descartado —
     perda desprezível.)
  6. `logged`: lê cookie `session`; se existe, `try {
     await adminAuth.verifySessionCookie(session); logged = true } catch {
     logged = false }`. **Sem `checkRevoked`** — validação só de assinatura/prazo,
     local, sem round-trip (mesmo critério do `updateSession`).
  7. `const day = dayKey()`, `const month = monthKey()`.
  8. **Uma transação Firestore** (`adminDb.runTransaction`):
     - refs: `dailyRef = analytics_daily/{day}`,
       `dailyMarker = analytics_daily/{day}/visitors/{vid}`,
       `monthlyRef = analytics_monthly/{month}`,
       `monthlyMarker = analytics_monthly/{month}/visitors/{vid}`.
     - lê os dois markers.
     - **Diário**: `dailyRef.set({ date: day, pageviews: increment(1),
       uniqueVisitors: increment(dailyMarker.exists ? 0 : 1),
       loggedVisitors: increment(precisaContarLogado(dailyMarker) ? 1 : 0),
       updatedAt: now }, { merge: true })`.
       - `precisaContarLogado(m)` = `logged && (!m.exists || m.data().logged !== true)`.
       - marker: se `!m.exists` → `set({ firstSeen: now, logged, expiresAt: now+60d })`;
         senão se `logged && !m.data().logged` → `update({ logged: true })`.
     - **Mensal**: idêntico, com `expiresAt: now + 400d`.
  9. **View de veículo**: se `path` casa `^/veiculos/([^/]+)/?$`, extrai `id` e
     (fora da transação, `set` com `merge`)
     `analytics_vehicle_daily/{day}`.set(
       `{ date: day, views: { [id]: increment(1) }, updatedAt: now }`,
       `{ merge: true }`) — `increment` aninhado em `merge` funciona no Admin SDK.
  10. `return new Response(null, { status: 204 })`.
- Rate limit: o `proxy.ts` já aplica `rateLimit('global:${ip}', 200, 60s)` e o
  matcher cobre `/api`. Suficiente para v1.

### Escritas por pageview (ordem de grandeza)

| cenário | escritas |
|---|---|
| visitante recorrente, mesmo dia, página comum | 2 (`analytics_daily` + `analytics_monthly`, só `pageviews`) |
| visitante novo no dia (já visto no mês) | ~3 (diário: doc + marker; mensal: doc) |
| visitante totalmente novo | ~4 (diário doc+marker, mensal doc+marker) |
| qualquer um acima numa página `/veiculos/{id}` | +1 |

Volume de uma revenda (centenas a poucos milhares de pageviews/dia) → custo
Firestore irrelevante.

## Modelo de dados (Firestore)

Datas sempre no fuso `America/Sao_Paulo`.

### `analytics_daily` — doc id `YYYY-MM-DD`

| campo | tipo | observações |
|---|---|---|
| `date` | string | `"2026-09-10"` (redundante com o id, facilita `orderBy`) |
| `pageviews` | number | total de pings válidos no dia |
| `uniqueVisitors` | number | `liberty_vid` distintos no dia |
| `loggedVisitors` | number | `liberty_vid` distintos que estavam logados em ≥ 1 ping no dia |
| `updatedAt` | Timestamp | |

### `analytics_daily/{day}/visitors` — doc id `{liberty_vid}`

| campo | tipo | observações |
|---|---|---|
| `firstSeen` | Timestamp | |
| `logged` | boolean | vira `true` se o visitante logar em algum momento do dia |
| `expiresAt` | Timestamp | `firstSeen + 60 dias` — alvo da política de TTL |

### `analytics_monthly` — doc id `YYYY-MM`

Mesmos campos de `analytics_daily` (`date` guarda `"2026-09"`). Dá o número
**real** de visitantes únicos do mês (sem inflar por retorno em dias diferentes).

### `analytics_monthly/{month}/visitors` — doc id `{liberty_vid}`

Igual ao marcador diário, com `expiresAt = firstSeen + 400 dias`.

### `analytics_vehicle_daily` — doc id `YYYY-MM-DD`

| campo | tipo | observações |
|---|---|---|
| `date` | string | |
| `views` | map `{ [veiculoId: string]: number }` | +1 por pageview em `/veiculos/{id}` (inclui recarga; é "visualizações", não "visitantes únicos") |
| `updatedAt` | Timestamp | |

### Índices

- `analytics_daily` / `analytics_monthly`: leitura por id ou `orderBy('date','desc')`
  → campo único, sem índice composto.
- `analytics_vehicle_daily`: leitura dos últimos 30 docs por id — sem índice.
- **Nenhuma entrada nova em `firestore.indexes.json`.**

### TTL (passo manual de operação)

Os markers (`visitors`) crescem 1 doc por visitante/dia e /mês. Para não
acumular para sempre, criar **manualmente** no console do GCP / Firebase duas
políticas de TTL no campo `expiresAt` para os **collection groups** `visitors`
(o console pede o nome do grupo; ambos os caminhos usam `visitors`, então uma
política de collection-group cobre os dois). Documentado aqui; não é
automatizável por código. Enquanto não for criada, o único efeito é storage
extra pequeno.

## Dashboard — `app/dashboard/analytics/`

### Permissão e navegação

- [`utils/permissions.ts`](../../../utils/permissions.ts): adicionar
  `analytics?: boolean` em `UserPermissions`.
- [`app/dashboard/layout.tsx`](../../../app/dashboard/layout.tsx) já carrega
  `permissions` do perfil e passa para o `DashboardShell`.
- [`app/components/DashboardShell.tsx`](../../../app/components/DashboardShell.tsx):
  novo item de nav `{ href: '/dashboard/analytics', label: 'Visitantes',
  icon: 'chart', roles: ['admin'], permissionKey: 'analytics' }` + case
  correspondente no `NavIcon` (`IconChartBar` do `@tabler/icons-react`), seguindo
  exatamente o padrão dos itens existentes.
- [`app/dashboard/page.tsx`](../../../app/dashboard/page.tsx): novo `ModuleCard`
  `{ href: '/dashboard/analytics', titulo: 'Visitantes do site', descricao:
  'Quantas pessoas acessam o site, quantas estão logadas e quais veículos são
  mais vistos.', icon: IconChartBar, badge: 'Admin', allowed: ['admin'] }`.
- Toggle de permissão `analytics` na tela de gestão de usuários
  ([`app/dashboard/usuarios`](../../../app/dashboard/usuarios)), no mesmo padrão
  dos toggles atuais.

### `app/dashboard/analytics/page.tsx` (server component)

- `const user = await getSessionUser()` → `redirect('/login')` se nulo.
- `hasPageAccess(user, 'analytics', ['admin'])` → senão
  `redirect('/dashboard?error=acesso_negado')` (padrão das outras abas).
- `export const metadata = { title: 'Visitantes | Liberty Car' }`.
- `loading.tsx` com Skeleton no padrão das outras abas.
- Leitura (função `getAnalyticsOverview()` em `actions.ts` ou inline no server
  component, com try/catch → devolve zeros em erro e um flag `erro: true`):
  - `analytics_daily`: `orderBy('date','desc').limit(30)` → série do gráfico
    (reordenada asc no render). O doc de hoje (`dayKey()`) sai daí.
  - `analytics_monthly`: `.doc(monthKey()).get()` → cartão do mês.
  - `analytics_vehicle_daily`: `orderBy('date','desc').limit(30)` → soma os
    `views` por `veiculoId` em memória; pega o top 10; busca os nomes com
    `adminDb.getAll(...top10.map(id => veiculos.doc(id)))` (ou
    `collection('veiculos').where(FieldPath.documentId(),'in', chunk)` em lotes
    de 10). Veículo apagado → mostra "Veículo removido" com o id.
- Render (`AnalyticsView`, pode ser server + um filho client só para o gráfico):
  - **Cartões** (grid, componentes de UI já existentes):
    - "Hoje" → `uniqueVisitors` de hoje, com subtítulo "X logados · Y anônimos".
    - "Este mês" → `uniqueVisitors` do mês, subtítulo "X logados · Y anônimos".
    - "Pageviews hoje" e "Pageviews no mês".
  - **Gráfico** "Visitantes únicos por dia — últimos 30 dias":
    `app/dashboard/analytics/VisitorsChart.tsx` (`'use client'`), **SVG à mão,
    sem dependência nova**. Duas linhas (total e logados), eixo X com marcações
    a cada ~5 dias, tooltip no hover mostrando data + números. Cores do tema
    (`--color-*` já usadas no dashboard). `viewBox` responsivo,
    `preserveAspectRatio`.
  - **Tabela "Veículos mais vistos (últimos 30 dias)"**: posição, nome
    (`marca modelo ano`, link para `/dashboard/veiculos/{id}` se existir),
    nº de visualizações. Vazio → estado "Ainda sem visualizações registradas".
  - Se `erro: true` → aviso discreto "Não foi possível carregar os dados agora."

### Sobre os números

- **Hoje / Este mês**: contagem exata de `liberty_vid` distintos (via markers).
- **"Logados"**: visitante que, em pelo menos um ping do período, tinha `session`
  válido. Não confundir com nº de contas — é nº de *dispositivos/navegadores*
  logados.
- **Gráfico**: `uniqueVisitors` por dia — somar as barras do gráfico **não** dá
  o total do mês (um visitante que volta em 3 dias aparece nos 3). O número do
  mês é o do cartão "Este mês".
- **"Veículos mais vistos"**: visualizações (com recarga), não visitantes únicos.

## Segurança / privacidade

- `liberty_vid` é UUID aleatório, `httpOnly`, `secure`, `SameSite=Lax`. Sem
  ligação com identidade, e-mail, CPF ou IP. Nenhum IP é gravado.
- O endpoint `/api/track` não recebe nem devolve PII; ignora tudo que não seja
  um `path` string. Sempre responde 204 (ou 204 em erro) — não vaza estado.
- O cookie `session` é só **lido** (verificação local) para o booleano `logged`;
  nunca é logado nem devolvido.
- **LGPD**: cookie estritamente analítico, first-party, sem PII e sem
  compartilhamento com terceiros — risco baixo; enquadra-se em legítimo
  interesse. Banner de consentimento fica **fora de escopo** nesta entrega
  (decisão do dono; pode ser adicionado depois sem mexer no modelo de dados).
- O dashboard de analytics é restrito a `admin` (permissão `analytics`).

## Pendências para o plano

- **Ler `node_modules/next/dist/docs/` antes de codar** (o projeto roda um
  Next.js 16 com breaking changes — AGENTS.md):
  - `01-app/03-api-reference/03-file-conventions/proxy.md` (já lido: `proxy.ts`,
    runtime Node, `response.cookies.set`).
  - Route Handlers (`route.ts`): assinatura, `cookies()` de `next/headers` em
    route handler, `runtime`.
  - `usePathname` / comportamento de efeito em navegação no App Router.
- Confirmar no `DashboardShell.tsx` o formato exato de `NavItem` / `NavIcon` e
  como `permissionKey` + `roles` são aplicados (espelhar item existente, ex.
  `anuncios`).
- Confirmar os componentes de cartão/estatística de UI já existentes no
  dashboard para reusar no lugar de criar novos.
- Verificar se o matcher do `proxy.ts` cobre a navegação client-side para
  `/api/track` (é `fetch`, não navegação — cai no matcher de `/api`, ok) e se
  não há conflito com o rate limit global em picos.

## Plano de testes (manual)

1. **Cookie**: primeira visita ao site em aba anônima → resposta traz
   `Set-Cookie: liberty_vid=...` (`HttpOnly`, `Secure`, `Max-Age` ~1 ano).
   Recarregar → não seta de novo (cookie reaproveitado).
2. **Bot**: `curl -A "Googlebot/2.1" https://site/` → sem `Set-Cookie
   liberty_vid`; `POST /api/track` com UA de bot → 204 e nada gravado.
3. **Pageview anônimo**: visitar `/` e `/veiculos` deslogado → `analytics_daily/{hoje}`
   com `uniqueVisitors: 1`, `loggedVisitors: 0`, `pageviews: 2`; marker do dia e
   do mês criados; `analytics_monthly/{mês}` com `uniqueVisitors: 1`.
4. **Recorrência mesmo dia**: recarregar `/` 3× → `pageviews` sobe,
   `uniqueVisitors` continua 1.
5. **Logado**: entrar no painel (cookie `session`), abrir o site público numa
   aba → `loggedVisitors` do dia e do mês vira 1 para aquele `liberty_vid`
   (mesmo que antes tenha navegado deslogado — o marker é atualizado uma única
   vez).
6. **Dashboard interno não conta**: navegar bastante dentro de `/dashboard` →
   nenhum incremento em `analytics_*`. Idem `/login`.
7. **Veículos mais vistos**: abrir `/veiculos/{A}` 5×, `/veiculos/{B}` 2× →
   `analytics_vehicle_daily/{hoje}.views` = `{ A: 5, B: 2 }`; a aba lista A antes
   de B com os nomes corretos; apagar B do estoque → aparece como "Veículo
   removido".
8. **Aba /dashboard/analytics**: `admin` vê os cartões, o gráfico com a série
   real e a tabela. Usuário sem permissão `analytics` (ex. `vendedor`) é
   redirecionado; o item some do menu.
9. **Resiliência**: derrubar credenciais do Firebase Admin (ou simular erro) →
   `/api/track` ainda responde 204, o site não quebra, nada no console do
   navegador.
10. **Dedupe Strict Mode**: em dev, uma navegação → **um** POST `/api/track`
    (não dois).
11. `npm run build` limpo; `npm run lint` limpo.
