# Plano de implementação — Changelog "o que há de novo"

**Spec:** `docs/superpowers/specs/2026-08-31-changelog-novidades-design.md`
**Branch:** `feat/changelog-novidades`
**Data:** 2026-08-31

Feature pequena, sem backend. Verificação de cada passo: `npm run build` +
`npx tsc --noEmit`; lint só nos arquivos novos/alterados.

## Decisões que o spec deixou em aberto

- **Posição no menu:** último item do `NAV_ITEMS` (abaixo de "Usuários") — é um
  item utilitário/meta.
- **Conteúdo inicial do `CHANGELOG`:** duas entradas reais já no primeiro commit:
  1. `2026-08-31-comprovante-email` — "Comprovante de pagamento por e-mail" (`novo`).
  2. `2026-08-31-central-novidades` — "Central de novidades" (`novo`).
  Assim o modal e a página têm o que mostrar desde já.

## Passo 1 — Dados

**Novo:** `constants/changelog.ts` — exatamente como no spec (tipos `ChangelogTag`,
`ChangelogEntry`, `CHANGELOG` mais-recente-primeiro, `entriesSince(lastSeenId)`),
com as 2 entradas iniciais acima.

**Verificação:** `npx tsc --noEmit`.

## Passo 2 — Item de apresentação

**Novo:** `app/components/ChangelogEntryItem.tsx` — server/client-neutro, sem
`'use client'`. Props `{ entry: ChangelogEntry }`. Renderiza:

- badge da tag: `novo` → `liberty`/verde, `melhoria` → azul/sky, `correcao` → âmbar;
- `title` (bold), `date` via `formatDate` de `@/utils/format`;
- `items` como `<ul>` de bullets.

Mapa `TAG_META: Record<ChangelogTag, { label; classes }>` local ao arquivo.

**Verificação:** `npx tsc --noEmit`.

## Passo 3 — Modal + gate

**Novo:** `app/components/ChangelogModal.tsx` (`'use client'`).

- `useState` para `entries: ChangelogEntry[] | null` (null = fechado).
- `useEffect(() => {...}, [])`:
  - `try { lastSeen = localStorage.getItem('changelog:lastSeenId') } catch { return }`
  - `const novas = entriesSince(lastSeen)`
  - `if (!CHANGELOG.length || !novas.length) return`
  - `setEntries(lastSeen ? novas : novas.slice(0, 5))`
- `close()`: `try { localStorage.setItem('changelog:lastSeenId', CHANGELOG[0].id) } catch {}`
  depois `setEntries(null)`.
- Render: se `entries` null → `null`. Guard `typeof document === 'undefined'` → `null`.
  `createPortal` para `document.body`, overlay `bg-neutral-950/60 backdrop-blur-sm`,
  card branco arredondado, header com `IconSparkles` + título "Novidades", lista de
  `ChangelogEntryItem`, footer com botão "Entendi".
- Fechar: botão, X no header, clique no overlay (`onMouseDown` target === currentTarget),
  tecla Esc (`useEffect` com listener `keydown` enquanto aberto). Todos chamam `close()`.
- `scroll` interno se a lista passar da altura (`max-h-[70vh] overflow-y-auto`).

**Verificação:** `npx tsc --noEmit` + lint do arquivo.

## Passo 4 — Página de histórico

**Novo:** `app/dashboard/novidades/page.tsx` (server component, sem `'use client'`).

- `Breadcrumb` (`[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Novidades' }]`),
  `h1` "Novidades", subtítulo "O que mudou no sistema a cada atualização."
- `CHANGELOG.length === 0` → bloco de estado vazio (padrão `EmptyState` se existir em
  `@/app/components/ui`, senão div simples): "Nenhuma novidade registrada ainda."
- Senão → `CHANGELOG.map(e => <ChangelogEntryItem key={e.id} entry={e} />)` numa lista
  com divisórias.

**Novo:** `app/dashboard/novidades/loading.tsx` — skeleton simples no padrão das outras
páginas (`app/dashboard/*/loading.tsx`).

**Verificação:** `npm run build` (gera a rota).

## Passo 5 — Montagem no layout

**Alterado:** `app/dashboard/layout.tsx` — importar `ChangelogModal` e renderizar
`<ChangelogModal />` dentro do `<main>`, após `{children}`:

```tsx
<main className="flex-1 min-w-0 px-4 py-8 md:px-8 md:pl-8">
  <div className="mx-auto max-w-7xl">{children}</div>
  <ChangelogModal />
</main>
```

**Verificação:** `npm run build`.

## Passo 6 — Item no menu

**Alterado:** `app/components/DashboardShell.tsx`

- `NavItem['icon']` union: adicionar `| 'sparkles'`.
- `NAV_ITEMS`: novo objeto no fim do array:
  ```ts
  {
    href: '/dashboard/novidades',
    label: 'Novidades',
    icon: 'sparkles',
    roles: ['admin', 'vendedor', 'advogado', 'suporte'],
  }
  ```
- Import `IconSparkles` de `@tabler/icons-react`.
- `NavIcon`: `case 'sparkles': return <IconSparkles className={cls} stroke={2} />`.

**Verificação:** `npm run build` + lint.

## Passo 7 — Verificação manual

Dev server já roda na :3000. Sem login não dá pra ver o dashboard, então o teste
completo é seu:

- `localStorage` limpo → `/dashboard` → modal aparece com as 2 novidades.
- Fechar (botão / X / Esc / clique fora) → recarregar → **não** reaparece.
- No devtools: `localStorage.removeItem('changelog:lastSeenId')` → recarregar → volta.
- `/dashboard/novidades` lista as 2 entradas; item "Novidades" no menu para todos os
  perfis.
- Adicionar uma 3ª entrada no topo do `CHANGELOG`, recarregar → modal só com a nova.

O que eu verifico: `build`, `tsc`, lint, e que a rota `/dashboard/novidades` aparece
no output do build.

## Passo 8 — Fechamento

`npm run lint` (sem erros novos) + `npm run build` limpos → commit único
`feat(dashboard): "o que há de novo" (changelog interno + página /novidades)` +
`Co-Authored-By`. Sem merge na master sem o "ok".

## Riscos

- **Nenhum backend, risco baixo.** O único ponto sensível é o `localStorage` em
  ambientes que bloqueiam storage (Safari private, etc.) — coberto pelo `try/catch`.
- `IconSparkles` existe em `@tabler/icons-react` v3 (usado no projeto). Se não existir
  na versão instalada, cair para `IconBell` ou `IconConfetti`.
