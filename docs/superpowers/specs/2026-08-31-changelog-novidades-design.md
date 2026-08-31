# "O que há de novo" — changelog interno do dashboard

**Data:** 2026-08-31
**Status:** aprovado (design)

## Problema

O desenvolvedor quer comunicar à equipe interna, de forma leve, toda vez que sobe uma
mudança significativa no sistema. Hoje não há nenhum canal para isso — as mudanças
entram no deploy sem que ninguém saiba o que mudou.

## Objetivo

Um "o que há de novo" que:

- mostra as novidades num **modal automático** no primeiro acesso ao dashboard após um
  deploy que trouxe novidades;
- mantém o **histórico completo** numa página `/dashboard/novidades`;
- é alimentado por um **arquivo no repositório**, editado no mesmo commit da mudança —
  sem banco, sem tela de admin, sincronizado com o deploy;
- é visível apenas para a **equipe interna** (usuários autenticados do dashboard).

## Não-objetivos (fora de escopo)

- Sino/badge com contador de novidades não lidas.
- Rastreio de "visto" por usuário no Firestore (usaremos `localStorage`).
- Edição de novidades por UI.
- Changelog público (para clientes / site de catálogo).
- Geração automática a partir de commits/tags do git.

## Decisões de design

| Questão | Decisão |
|---|---|
| Público | Só equipe interna (qualquer perfil autenticado no dashboard). |
| Autoria | Arquivo `constants/changelog.ts` versionado, editado junto com o commit da mudança. |
| Como aparece | Modal automático no primeiro acesso pós-deploy com novidades. |
| Rastrear "visto" | `localStorage` do navegador (por dispositivo). |
| Histórico | Página `/dashboard/novidades` lista todo o `CHANGELOG`. |

Trade-off aceito do `localStorage`: trocar de navegador/dispositivo ou limpar os dados
faz o modal reaparecer uma vez. Aceitável para uma equipe pequena; o histórico completo
continua acessível na página.

## Arquitetura

### Dados — `constants/changelog.ts` (novo)

Segue o padrão de `constants/debitos.ts` (arquivo de constantes tipado).

```ts
export type ChangelogTag = 'novo' | 'melhoria' | 'correcao'

export interface ChangelogEntry {
  /** Estável e ordenável. Convenção: "YYYY-MM-DD-slug". Nunca reutilizar/renomear. */
  id: string
  /** "YYYY-MM-DD" — exibido ao usuário. */
  date: string
  /** Título curto da novidade. */
  title: string
  tag: ChangelogTag
  /** O que mudou, em bullets curtos. */
  items: string[]
}

/** Mais recente primeiro. Adicione novas entradas SEMPRE no topo do array. */
export const CHANGELOG: ChangelogEntry[] = [
  // exemplo (substituir pela primeira novidade real):
  // {
  //   id: '2026-08-31-primeira-novidade',
  //   date: '2026-08-31',
  //   title: 'Central de novidades',
  //   tag: 'novo',
  //   items: ['Agora você vê aqui o que mudou no sistema a cada atualização.'],
  // },
]

/**
 * Entradas mais novas que `lastSeenId` (todas, se `lastSeenId` for null/desconhecido).
 * Como `CHANGELOG` está em ordem decrescente, retorna o prefixo do array até
 * encontrar `lastSeenId`.
 */
export function entriesSince(lastSeenId: string | null): ChangelogEntry[] {
  if (!lastSeenId) return CHANGELOG
  const idx = CHANGELOG.findIndex((e) => e.id === lastSeenId)
  return idx === -1 ? CHANGELOG : CHANGELOG.slice(0, idx)
}
```

### `app/components/ChangelogEntryItem.tsx` (novo)

Componente **puramente de apresentação** de uma entrada. Sem estado, sem efeitos.

- Props: `{ entry: ChangelogEntry }`.
- Renderiza: badge da tag (cor por tag — `novo` verde/liberty, `melhoria` azul,
  `correcao` âmbar), `title`, `date` formatada em pt-BR, e `items` como lista.
- Usado pelo modal e pela página, para não duplicar markup.

### `app/components/ChangelogModal.tsx` (novo)

Client component (`'use client'`). Responsável pelo "gate" + o modal.

Lógica:

1. No mount (`useEffect`), lê `localStorage.getItem('changelog:lastSeenId')` dentro de
   `try/catch`. Qualquer erro → não abre nada e encerra.
2. `novas = entriesSince(lastSeenId)`. Se `CHANGELOG.length === 0` ou `novas.length === 0`
   → não abre.
3. Primeiro acesso (`lastSeenId` null): mostra no máximo as **5** entradas mais recentes
   (`novas.slice(0, 5)`). Caso contrário mostra todas as `novas`.
4. Abre o modal (`createPortal` para `document.body`, mesmo estilo visual dos modais de
   `CobrancasClient` — overlay `bg-neutral-950/60 backdrop-blur-sm`, card branco
   arredondado, header com ícone).
5. Fechar por **qualquer** via (botão "Entendi", X, clique no overlay, tecla Esc):
   grava `CHANGELOG[0].id` em `localStorage` (dentro de `try/catch`) e desmonta o modal.

Guardas:

- `typeof window === 'undefined'` / `typeof document === 'undefined'` → retorna `null`
  (nunca renderiza no SSR).
- Não há chamada de rede, não há dependência de props além do que importa de
  `constants/changelog.ts`.

### `app/dashboard/novidades/page.tsx` (novo)

Server component. Sem autorização extra além do `app/dashboard/layout.tsx` (que já
redireciona para `/login` sem sessão).

- Header/breadcrumb no padrão das outras páginas (`Breadcrumb` de
  `@/app/components/ui`, título `h1`, subtítulo).
- Lista `CHANGELOG` inteiro via `ChangelogEntryItem`.
- `CHANGELOG` vazio → estado vazio ("Nenhuma novidade registrada ainda.").

### `app/dashboard/layout.tsx` (alterado)

Renderiza `<ChangelogModal />` dentro do `<main>`, depois de `{children}`. É o único
ponto de montagem do modal, e só no dashboard — o que já restringe ao público interno.

### `app/components/DashboardShell.tsx` (alterado)

- Novo item em `NAV_ITEMS`:
  ```ts
  {
    href: '/dashboard/novidades',
    label: 'Novidades',
    icon: 'sparkles',
    roles: ['admin', 'vendedor', 'advogado', 'suporte'],
  }
  ```
  Sem `permissionKey` → cai em `item.roles.includes(role)`; todos os perfis atuais estão
  listados. `admin` já passa por short-circuit.
- Adicionar `'sparkles'` ao union de tipos `NavItem['icon']` e um `case 'sparkles'` em
  `NavIcon` usando `IconSparkles` de `@tabler/icons-react` (import novo).
- Posição sugerida: por último na lista, ou logo após "Visão Geral". (Escolha final no
  plano de implementação — é só ordem do array.)

## Fluxo de dados

```
Deploy (constants/changelog.ts atualizado)
        │
usuário entra em /dashboard/*
        │
ChangelogModal (mount)
  ├─ lê localStorage['changelog:lastSeenId']
  ├─ entriesSince(lastSeenId)
  │     ├─ vazio            → não faz nada
  │     └─ tem entradas     → abre modal (máx. 5 no 1º acesso)
  └─ fechar (qualquer via)  → localStorage['changelog:lastSeenId'] = CHANGELOG[0].id

/dashboard/novidades  → renderiza CHANGELOG inteiro (independe de localStorage)
```

## Tratamento de erros / bordas

| Situação | Comportamento |
|---|---|
| `localStorage` limpo / usuário novo | Modal 1x com as 5 entradas mais recentes; histórico completo na página |
| Vários deploys sem o usuário entrar | Ao entrar, modal com tudo acumulado desde a última entrada vista |
| Navega sem clicar "Entendi" e recarrega | Modal reaparece (só é marcado como visto ao fechar) — comportamento aceito |
| `CHANGELOG` vazio | Sem modal; página mostra estado vazio |
| `localStorage` indisponível ou lança | `try/catch` → sem modal, sem erro no console do usuário |
| `lastSeenId` não existe mais no array (entrada removida) | `entriesSince` retorna `CHANGELOG` inteiro → trata como 1º acesso (cap de 5). Por isso a convenção de **nunca remover** entradas antigas |
| SSR | `ChangelogModal` retorna `null` até montar no cliente |

## Convenções para manter

- **Nunca** renomear ou remover um `id` já publicado — é a chave de comparação no
  `localStorage` dos usuários.
- Entradas novas **sempre no topo** do array (ordem decrescente é assumida por
  `entriesSince` e pela página).
- Adicionar a entrada do changelog **no mesmo commit** da mudança que ela descreve.

## Teste

O projeto não tem runner de testes. Verificação:

1. `npm run lint` e `npm run build` passam.
2. Manual, no dev server:
   - `localStorage` limpo → abrir `/dashboard` → modal aparece com as novidades.
   - Fechar → recarregar → modal **não** reaparece.
   - Adicionar uma entrada nova no topo de `CHANGELOG` → recarregar → modal reaparece
     mostrando **apenas** a nova.
   - `/dashboard/novidades` lista todas as entradas e o item "Novidades" aparece no menu
     para todos os perfis.
   - Simular `CHANGELOG = []` → sem modal; página mostra estado vazio.
