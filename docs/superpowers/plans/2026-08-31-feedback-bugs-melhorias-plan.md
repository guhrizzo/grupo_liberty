# Plano de implementação — Feedback (bugs & melhorias)

**Spec:** `docs/superpowers/specs/2026-08-31-feedback-bugs-melhorias-design.md`
**Branch:** `feat/feedback-bugs-melhorias`
**Data:** 2026-08-31

Verificação de cada passo: `npx tsc --noEmit` + `npm run build`; lint só nos
arquivos novos/alterados. Sem merge na master sem "ok".

## Decisões que o spec deixou em aberto

- **Posição no menu:** último item do `NAV_ITEMS`, depois de "Novidades".
- **Append em `atualizacoes`:** read-modify-write (ler doc, `push`, `update`) — não
  `arrayUnion`. Escritor único (o dono), volume baixo; mais simples e sem risco de
  dedupe.
- **Ordenação da lista:** `orderBy('criadoEm', 'desc')` — só um campo, sem `where`, então
  o índice automático de campo único do Firestore atende (igual `getTransacoes`).
- **`atualizadoEm` na criação:** igual a `criadoEm`.

## Passo 1 — Constantes e tipos

**Novo:** `constants/feedback.ts`
- `OWNER_EMAIL = 'gurizzo943@gmail.com'`
- `export type FeedbackTipo = 'bug' | 'melhoria'`
- `export type FeedbackStatus = 'aberto' | 'em_analise' | 'resolvido' | 'descartado'`
- `FEEDBACK_STATUS: Record<FeedbackStatus, { label: string; classes: string }>`
  (âmbar / sky / esmeralda / neutro)
- `FEEDBACK_TIPOS: Record<FeedbackTipo, { label: string; classes: string }>`
  (bug → rose, melhoria → liberty)
- `FEEDBACK_STATUS_ORDEM: FeedbackStatus[]` para o seletor.
- Sem `import 'server-only'` — usado no client e no servidor.

**Verificação:** `npx tsc --noEmit`.

## Passo 2 — Gate `isOwner`

**Alterado:** `utils/permissions.ts` — adicionar, importando `OWNER_EMAIL` de
`@/constants/feedback`:

```ts
export function isOwner(user: SessionUser | null | undefined): boolean {
  const email = user?.email?.toLowerCase().trim()
  return !!email && email === OWNER_EMAIL.toLowerCase()
}
```

**Verificação:** `npx tsc --noEmit`.

## Passo 3 — Tipos serializáveis

**Novo:** `app/dashboard/feedback/types.ts`

```ts
import type { FeedbackTipo, FeedbackStatus } from '@/constants/feedback'

export interface FeedbackAtualizacao { texto: string; em: string }

export interface Feedback {
  id: string
  tipo: FeedbackTipo
  titulo: string
  descricao: string
  tela: string | null
  status: FeedbackStatus
  criadoPorUid: string
  criadoPorNome: string
  criadoPorEmail: string | null
  criadoEm: string
  atualizadoEm: string
  atualizacoes: FeedbackAtualizacao[]
}

export type FeedbackFieldErrors = { titulo?: string; descricao?: string; tela?: string; tipo?: string }
export type FeedbackResponse = { success?: string; error?: string; fieldErrors?: FeedbackFieldErrors }
```

**Verificação:** `npx tsc --noEmit`.

## Passo 4 — Server actions

**Novo:** `app/dashboard/feedback/actions.ts` (`'use server'`)

Imports: `revalidatePath`, `adminDb` de `@/utils/firebase/admin`, `getSessionUser` de
`@/utils/permissions`, `isOwner` de `@/utils/permissions`, tipos.

Helpers locais:
- `serialize(doc): Feedback` — normaliza campos, `atualizacoes: data.atualizacoes ?? []`,
  ordena `atualizacoes` por `em` asc.
- `async function assertOwner()` — `const user = await getSessionUser(); if (!user) throw...;
  if (!isOwner(user)) throw new Error('Acesso negado. Apenas o responsável pode fazer a triagem.')`
  → mas seguindo o padrão do projeto, as actions **capturam** e retornam `{ error }`.

| Action | Corpo |
|---|---|
| `getFeedback(): Promise<Feedback[]>` | `getSessionUser()` null → `[]`. `adminDb.collection('feedback').orderBy('criadoEm','desc').get()` → `map(serialize)`. try/catch → `[]` + `console.error`. |
| `criarFeedback(formData): Promise<FeedbackResponse>` | `user = getSessionUser()` null → `{ error: 'Não autenticado.' }`. Ler `tipo`, `titulo`, `descricao`, `tela`. Validar: `tipo ∈ {bug,melhoria}` senão `fieldErrors.tipo`; `titulo` trim 1..140; `descricao` trim 1..4000; `tela` trim 0..140 (→ `null` se vazio). `fieldErrors` não vazio → `{ error: 'Verifique os campos.', fieldErrors }`. `adminDb.collection('feedback').add({ tipo, titulo, descricao, tela, status:'aberto', criadoPorUid:user.uid, criadoPorNome:user.name ?? user.email ?? 'Usuário', criadoPorEmail:user.email ?? null, criadoEm:now, atualizadoEm:now, atualizacoes:[] })`. `revalidatePath('/dashboard/feedback')`. `{ success: 'Report enviado. Obrigado!' }`. |
| `atualizarStatusFeedback(id, status): Promise<FeedbackResponse>` | gate `isOwner` (via getSessionUser). `status ∈` enum senão `{ error }`. `ref.get()` não existe → `{ error: 'Report não encontrado.' }`. `ref.update({ status, atualizadoEm: now })`. revalidate. `{ success: 'Status atualizado.' }`. |
| `adicionarAtualizacaoFeedback(id, texto): Promise<FeedbackResponse>` | gate `isOwner`. `texto` trim 1..2000 senão `{ error }`. `doc.get()`; `atualizacoes = [...(data.atualizacoes ?? []), { texto, em: now }]`. `ref.update({ atualizacoes, atualizadoEm: now })`. revalidate. `{ success: 'Atualização adicionada.' }`. |
| `deletarFeedback(id): Promise<FeedbackResponse>` | gate `isOwner`. `ref.delete()`. revalidate. `{ success: 'Report removido.' }`. |

**Verificação:** `npx tsc --noEmit` + lint.

## Passo 5 — Página + loading

**Novo:** `app/dashboard/feedback/page.tsx` (server component)
- `getSessionUser()` → null → `redirect('/login')` (defensivo).
- `const [itens] = await Promise.all([getFeedback()])`; `const owner = isOwner(user)`.
- `<FeedbackClient itens={itens} isOwner={owner} currentUserName={user.name ?? user.email ?? ''} />`
- `export const metadata = { title: 'Bugs & Melhorias | Liberty Car', ... }`

**Novo:** `app/dashboard/feedback/loading.tsx` — skeleton (padrão de
`app/dashboard/novidades/loading.tsx` / manutencao).

**Verificação:** `npm run build` (rota gerada).

## Passo 6 — FeedbackClient

**Novo:** `app/dashboard/feedback/FeedbackClient.tsx` (`'use client'`). Estrutura
espelhando `CobrancasClient.tsx` mas menor.

Props: `{ itens: Feedback[]; isOwner: boolean; currentUserName: string }`.

Estado:
- `showModal`, `loadingForm` — modal novo report
- `expandedId` — card expandido
- `filtroTipo: 'todos' | FeedbackTipo`, `filtroStatus: 'todos' | FeedbackStatus`
- `deleteId` — confirmação de exclusão
- `isPending` de `useTransition` para status/atualização/delete
- form: `tipo`, `titulo`, `descricao`, `tela`
- `novaAtualizacao` (texto por card aberto — string simples, resetada ao trocar de card)

Layout:
1. Header: `Breadcrumb` + `h1` "Bugs & Melhorias" + subtítulo + botão "Novo report".
2. KPIs simples (opcional, enxuto): total, abertos, em análise, resolvidos — 4 chips.
3. Filtros: dois grupos de pills (tipo, status) no estilo de `CobrancasClient`.
4. Lista de cards (`cobrancasFiltradas` → `itensFiltrados`):
   - recolhido: badge tipo, badge status, título, `criadoPorNome`, `formatDate(criadoEm)`.
   - expandido: `descricao` (whitespace-pre-wrap), `tela` se houver, log de
     `atualizacoes` (cada: texto + `formatDateTime(em)`), e — se `isOwner`:
     - grupo de pills de status → `handleStatus(id, status)`
     - `Textarea` + botão "Adicionar atualização" → `handleAtualizacao(id)`
     - botão "Excluir" (ghost, rose) → abre `ConfirmDialog`
5. `EmptyState` quando `itens.length === 0` ("Nenhum report ainda — seja o primeiro.").
   Quando filtrado a zero: "Nenhum report com esses filtros."
6. Modal "Novo report" (`createPortal`, casca do `PagamentoModal`): radio `tipo`
   (2 botões toggle), `Input` título, `Textarea` descrição, `Input` tela (opcional),
   erros de `fieldErrors` inline. Submit → `criarFeedback(FormData)`.

Handlers: cada mutação chama a action, `toast.error`/`toast.success`, `router.refresh()`,
fecha modal/limpa campo. Padrão idêntico ao `CobrancasClient`.

**Verificação:** `npm run build` + lint.

## Passo 7 — Item no menu

**Alterado:** `app/components/DashboardShell.tsx`
- `NavItem['icon']` union: `| 'bug'`.
- Import `IconBug` de `@tabler/icons-react`.
- `NavIcon`: `case 'bug': return <IconBug className={cls} stroke={2} />`.
- `NAV_ITEMS`: novo item no fim (depois de "Novidades"):
  ```ts
  { href: '/dashboard/feedback', label: 'Bugs & Melhorias', icon: 'bug',
    roles: ['admin', 'vendedor', 'advogado', 'suporte'] }
  ```

**Verificação:** `npm run build` + lint.

## Passo 8 — Verificação manual (precisa de login → usuário)

- Usuário comum: criar report `bug` e `melhoria` → aparecem "Aberto", sem controles.
- Logar como `gurizzo943@gmail.com`: controles aparecem; mudar status; adicionar 2
  atualizações (ordem cronológica); excluir um report.
- Recarregar como comum: mudanças refletidas, sem controles.
- Filtros tipo/status; validação (título vazio → erro no modal); estado vazio.
- Item "Bugs & Melhorias" no menu para todos os perfis.

Eu verifico: `tsc`, `build`, lint, rota no output do build, e um teste de fumaça das
actions (validação e gate) via script tsx com `adminDb` mockado se viável — senão só
`tsc`/`build`.

## Passo 9 — Fechamento

`npm run lint` (sem erros novos) + `npm run build` limpos → commit
`feat(dashboard): página de feedback (bugs & melhorias)` + `Co-Authored-By`.

## Riscos

- **`FeedbackClient` grande** — mitigar mantendo componentes auxiliares (`FeedbackCard`,
  `NovoReportModal`) no mesmo arquivo, como em `CobrancasClient`.
- **Índice do Firestore** — `orderBy('criadoEm','desc')` sem `where` não precisa de índice
  composto. Se o Firestore reclamar em runtime, criar o índice de campo único (link no
  erro) — mas não deve acontecer.
- **`getSessionUser().name`** pode ser `null` (perfis sem displayName) — fallback para
  `email` e depois `'Usuário'` na hora de gravar `criadoPorNome`.
