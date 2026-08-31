# Página de feedback — reportar bugs e sugerir melhorias

**Data:** 2026-08-31
**Status:** aprovado (design)

## Problema

A equipe interna não tem um canal estruturado para reportar bugs do sistema nem para
sugerir melhorias. Hoje isso acontece de forma informal e se perde.

## Objetivo

Uma página no dashboard onde:

- qualquer usuário logado abre um **report** (bug ou sugestão de melhoria);
- todos veem a lista completa de reports e o status de cada um;
- apenas o **dono do sistema** (gate por e-mail) faz a triagem: muda o status e
  registra atualizações no report.

## Não-objetivos (fora de escopo)

- Upload de screenshot / anexos.
- E-mail de notificação ao criar/atualizar um report.
- Comentários de outros usuários (só o dono escreve no log).
- Votação em sugestões de melhoria.
- Ligação automática com o changelog ("virou novidade").
- Formulários distintos por tipo com campos diferentes.

## Decisões de design

| Questão | Decisão |
|---|---|
| Persistência | Coleção `feedback` no Firestore, via server actions (admin SDK) |
| Tipos | Um formulário único com campo `tipo`: `bug` / `melhoria` |
| Quem envia | Qualquer usuário autenticado no dashboard |
| Quem vê a lista | Todos (leitura) |
| Quem faz triagem | Só o dono — `OWNER_EMAIL = 'gurizzo943@gmail.com'` (comparação case-insensitive) |
| Interação do dono | Mudar status + adicionar atualizações (log só do dono) |
| Campos do formulário | `tipo`, `titulo`, `descricao`, `tela` (opcional) |

### Sobre o gate por e-mail

O sistema de acesso atual (`utils/permissions.ts`) é todo por `role` / `permissions` no
perfil do Firestore. Não existe conceito de "dono". Este spec introduz um gate simples e
único: uma constante `OWNER_EMAIL` e um helper `isOwner(user)`. É deliberadamente
grosseiro — só uma pessoa faz triagem. Se no futuro precisar de mais de um responsável,
troca-se por uma role/permission dedicada.

## Modelo de dados — coleção `feedback`

```ts
export type FeedbackTipo = 'bug' | 'melhoria'
export type FeedbackStatus = 'aberto' | 'em_analise' | 'resolvido' | 'descartado'

export interface FeedbackAtualizacao {
  texto: string
  em: string // ISO — quando o dono registrou
}

// Documento no Firestore (coleção `feedback`)
export interface FeedbackDoc {
  tipo: FeedbackTipo
  titulo: string
  descricao: string
  tela: string | null            // "onde aconteceu" — texto livre opcional
  status: FeedbackStatus         // começa 'aberto'
  criadoPorUid: string
  criadoPorNome: string
  criadoPorEmail: string | null
  criadoEm: string               // ISO
  atualizadoEm: string           // ISO — muda a cada mudança de status ou atualização
  atualizacoes: FeedbackAtualizacao[] // log; só o dono escreve
}

// Versão serializada entregue ao client
export interface Feedback extends FeedbackDoc {
  id: string
}
```

O log de atualizações é um **array no próprio documento** (não uma subcoleção): volume
baixíssimo, só o dono escreve, e a página sempre carrega o report inteiro.

### Labels e cores de status

Definidos em `constants/feedback.ts`:

| status | label | cor (badge) |
|---|---|---|
| `aberto` | Aberto | âmbar |
| `em_analise` | Em análise | azul / liberty |
| `resolvido` | Resolvido | esmeralda |
| `descartado` | Descartado | neutro |

Tipos: `bug` → vermelho/rosa; `melhoria` → liberty.

## Arquitetura

### `constants/feedback.ts` (novo)

- `OWNER_EMAIL` (string).
- Reexporta / define os tipos `FeedbackTipo`, `FeedbackStatus`.
- `FEEDBACK_STATUS`: mapa `status → { label, tomClasses }` para a UI.
- `FEEDBACK_TIPOS`: mapa `tipo → { label, tomClasses }`.

### `utils/permissions.ts` (alterado)

```ts
import { OWNER_EMAIL } from '@/constants/feedback'

/** Gate do dono do sistema — única pessoa que faz triagem de feedback. */
export function isOwner(user: SessionUser | null | undefined): boolean {
  const email = user?.email?.toLowerCase().trim()
  return !!email && email === OWNER_EMAIL.toLowerCase()
}
```

(`constants/feedback.ts` não importa `server-only`, então pode ser importado tanto pelo
`permissions.ts` quanto pelo client.)

### `app/dashboard/feedback/types.ts` (novo)

Tipos serializáveis (`Feedback`, `FeedbackResponse`, `FeedbackFieldErrors`) — arquivo
separado porque `actions.ts` (`'use server'`) só exporta funções async.

### `app/dashboard/feedback/actions.ts` (novo — `'use server'`)

Todas as actions usam `getSessionUser()` de `utils/permissions`.

| Action | Autorização | Comportamento |
|---|---|---|
| `getFeedback()` | qualquer sessão válida | Lista `feedback` ordenada por `criadoEm` desc. Sessão inválida → `[]`. |
| `criarFeedback(formData)` | qualquer sessão válida | Valida `tipo ∈ {bug,melhoria}`, `titulo` (1..140), `descricao` (1..4000), `tela` (0..140). Grava com `status: 'aberto'`, `atualizacoes: []`, dados do autor a partir da sessão. `revalidatePath('/dashboard/feedback')`. |
| `atualizarStatusFeedback(id, status)` | `isOwner` | Valida `status`. Atualiza `status` + `atualizadoEm`. Doc inexistente → erro. |
| `adicionarAtualizacaoFeedback(id, texto)` | `isOwner` | `texto` (1..2000). `arrayUnion`/append em `atualizacoes` + `atualizadoEm`. |
| `deletarFeedback(id)` | `isOwner` | Remove o documento. |

Retorno padrão: `{ success?: string; error?: string; fieldErrors?: FeedbackFieldErrors }`.

Erros de autorização retornam `{ error: 'Acesso negado. ...' }` (não lançam), seguindo o
padrão de `cobrancas/actions.ts`.

### `app/dashboard/feedback/page.tsx` (novo — server component)

- `getSessionUser()` → se null, o `app/dashboard/layout.tsx` já redirecionou; ainda assim
  trata defensivamente.
- Carrega `getFeedback()` e calcula `isOwner(user)`.
- Renderiza `<FeedbackClient itens={...} isOwner={...} currentUserName={...} />`.

### `app/dashboard/feedback/FeedbackClient.tsx` (novo — client)

Segue o padrão visual/estrutural de `CobrancasClient.tsx`:

- Header com breadcrumb + título + botão "Novo report".
- Filtros: tipo (`todos` / `bug` / `melhoria`) e status (`todos` / cada status).
- Lista de cards; clicar expande o card (não navega para outra rota).
- Card recolhido: badge de tipo, badge de status, título, autor, data.
- Card expandido: descrição completa, `tela` (se houver), e o **log de atualizações**
  (lista cronológica de `atualizacoes`).
- Se `isOwner`:
  - seletor de status inline (chama `atualizarStatusFeedback`);
  - textarea + botão "Adicionar atualização" (chama `adicionarAtualizacaoFeedback`);
  - botão de excluir (com `ConfirmDialog`, chama `deletarFeedback`).
- Se não for owner: nenhum controle — só leitura.
- Modal "Novo report" (`createPortal`, estilo dos modais existentes): radio `tipo`,
  input `titulo`, textarea `descricao`, input `tela` (opcional). Chama `criarFeedback`.
- Usa `useToast`, `useTransition`/`useState` para loading, `router.refresh()` após
  cada mutação — igual ao `CobrancasClient`.

### `app/dashboard/feedback/loading.tsx` (novo)

Skeleton no padrão das outras páginas do dashboard.

### `app/components/DashboardShell.tsx` (alterado)

- Novo item em `NAV_ITEMS`:
  ```ts
  {
    href: '/dashboard/feedback',
    label: 'Bugs & Melhorias',
    icon: 'bug',
    roles: ['admin', 'vendedor', 'advogado', 'suporte'],
  }
  ```
  Sem `permissionKey` → cai em `item.roles.includes(role)`; todos os perfis atuais
  listados. `admin` passa por short-circuit.
- Adicionar `'bug'` ao union `NavItem['icon']` e um `case 'bug'` em `NavIcon` com
  `IconBug` de `@tabler/icons-react` (import novo).

## Fluxo de dados

```
Usuário logado → /dashboard/feedback
   │
   ├─ "Novo report" → modal → criarFeedback(formData)
   │      → doc em `feedback` { status: 'aberto', atualizacoes: [] }
   │      → revalidatePath → aparece na lista pra todos
   │
   └─ (dono) expande card
          ├─ muda status  → atualizarStatusFeedback(id, status)
          └─ escreve nota → adicionarAtualizacaoFeedback(id, texto)
                 → revalidatePath → todos veem status/log atualizados

Não-dono: vê tudo, controles escondidos no client e barrados nas actions.
```

Todas as escritas passam pelo Admin SDK dentro de server actions — não há acesso direto
do client ao Firestore, então não dependem de Firestore Security Rules.

## Tratamento de erros / bordas

| Situação | Comportamento |
|---|---|
| Não-dono chama `atualizarStatus`/`adicionarAtualizacao`/`deletar` (via devtools) | Action verifica `isOwner` e retorna `{ error: 'Acesso negado.' }` |
| `titulo` ou `descricao` vazios / longos demais | `fieldErrors` no retorno; modal destaca e não fecha |
| `tipo` ou `status` fora do enum | Action rejeita com erro |
| Coleção `feedback` vazia | Estado vazio: "Nenhum report ainda — seja o primeiro a reportar." |
| Report deletado enquanto outro usuário o via | `router.refresh()` tira da lista; action sobre doc inexistente → `{ error }` tratado com toast |
| `tela` não informada | Salvo como `null`; não renderiza no card |
| Sessão expira no meio | `getSessionUser()` → null → actions retornam erro; layout redireciona no próximo load |

## Convenções

- `OWNER_EMAIL` fica em `constants/feedback.ts` — ponto único de verdade.
- Nenhuma action de escrita confia em dado de autoria vindo do client: autor sempre da
  sessão; `isOwner` sempre reavaliado no servidor.

## Teste

O projeto não tem runner de testes. Verificação:

1. `npm run lint` e `npm run build` passam.
2. Manual, no dev server:
   - Como usuário comum: criar um report `bug` e um `melhoria`; confirmar que aparecem
     na lista com status "Aberto" e sem controles de triagem.
   - Como `OWNER_EMAIL`: ver os controles; mudar status para "Em análise" e "Resolvido";
     adicionar duas atualizações e conferir a ordem cronológica; excluir um report.
   - Recarregar como usuário comum: status e log refletidos, controles ausentes.
   - Filtros por tipo e por status.
   - Validação: enviar com título vazio → erro no modal.
   - Estado vazio com a coleção limpa.
   - Item "Bugs & Melhorias" aparece no menu para todos os perfis.
