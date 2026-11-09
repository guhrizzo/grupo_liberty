import { cn } from '@/utils/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-md bg-neutral-200/80 neon-theme:bg-[var(--color-bg-3)] adobe-dark:bg-adobe-bg-3 animate-pulse',
        className,
      )}
    />
  )
}

/** Mesma "casca" de card das telas do painel. */
const CARD =
  'rounded-xl border border-neutral-200 bg-white shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2'

/** Card de veículo da grade do estoque: foto 16:9, selo, título, dados e preço. */
export function SkeletonCard() {
  return (
    <div className={cn(CARD, 'overflow-hidden')}>
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-5 w-28" />
      </div>
    </div>
  )
}

export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-3 w-full" />
        </td>
      ))}
    </tr>
  )
}

// ─── Blocos para montar o esqueleto de cada tela com o formato real ───────────

/** Raiz do esqueleto de uma tela do painel (mesmo espaçamento das páginas). */
export function SkeletonPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-6', className)} aria-busy="true" aria-label="Carregando">
      {children}
    </div>
  )
}

/**
 * Cabeçalho da tela: migalhas, título (text-3xl), subtítulo e botões de ação.
 * `acoes` são as larguras (classes `w-*`) dos botões à direita.
 */
export function SkeletonHeader({
  subtitle = true,
  acoes = [],
  breadcrumb = true,
}: {
  subtitle?: boolean
  acoes?: string[]
  breadcrumb?: boolean
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        {breadcrumb && <Skeleton className="hidden h-3 w-40 md:block" />}
        <Skeleton className="h-6 w-44 md:h-9 md:w-72" />
        {subtitle && <Skeleton className="h-3 w-full max-w-lg md:h-4" />}
      </div>
      {acoes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {acoes.map((w, i) => (
            <Skeleton key={i} className={cn('h-10 rounded-lg', w)} />
          ))}
        </div>
      )}
    </header>
  )
}

/** Abas em "pílula" (Cobranças, Financeiro, Jurídico…). */
export function SkeletonTabs({ itens = 3 }: { itens?: number }) {
  return (
    <div className={cn(CARD, 'inline-flex gap-1 p-1')}>
      {Array.from({ length: itens }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-24 rounded-lg" />
      ))}
    </div>
  )
}

/** Cartões de resumo (rótulo pequeno + número grande). */
export function SkeletonStats({
  itens = 4,
  className = 'grid-cols-2 lg:grid-cols-4',
}: {
  itens?: number
  className?: string
}) {
  return (
    <div className={cn('grid gap-3', className)}>
      {Array.from({ length: itens }).map((_, i) => (
        <div key={i} className={cn(CARD, 'p-4')}>
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-7 w-16" />
        </div>
      ))}
    </div>
  )
}

/** Barra de busca + chips de filtro + botões, como nas listas do painel. */
export function SkeletonToolbar({
  busca = true,
  chips = 0,
  direita = 0,
}: {
  busca?: boolean
  chips?: number
  direita?: number
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {busca && <Skeleton className="h-10 w-full rounded-lg sm:w-72" />}
        {chips > 0 && (
          <div className="flex gap-1.5">
            {Array.from({ length: chips }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-20 rounded-lg sm:w-24" />
            ))}
          </div>
        )}
      </div>
      {direita > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: direita }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-lg" />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Lista de cartões-linha: miniatura opcional, selos, título, detalhe e ação.
 * Serve para tarefas, anúncios, propostas, quitações, compromissos etc.
 */
export function SkeletonRows({
  linhas = 5,
  miniatura = false,
  selos = 2,
  acao = true,
}: {
  linhas?: number
  miniatura?: boolean
  selos?: number
  acao?: boolean
}) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: linhas }).map((_, i) => (
        <li key={i} className={cn(CARD, 'flex items-center gap-3 p-4')}>
          {miniatura && <Skeleton className="h-14 w-20 shrink-0 rounded-lg" />}
          <div className="min-w-0 flex-1 space-y-2">
            {selos > 0 && (
              <div className="flex items-center gap-2">
                {Array.from({ length: selos }).map((_, j) => (
                  <Skeleton key={j} className="h-5 w-16 rounded-full" />
                ))}
              </div>
            )}
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          {acao && <Skeleton className="h-9 w-24 shrink-0 rounded-lg" />}
        </li>
      ))}
    </ul>
  )
}

/** Tabela dentro de um card: cabeçalho + linhas. */
export function SkeletonTable({ colunas = 5, linhas = 6 }: { colunas?: number; linhas?: number }) {
  return (
    <div className={cn(CARD, 'overflow-hidden')}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50/60 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-3/40">
            {Array.from({ length: colunas }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Skeleton className="h-2.5 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 adobe-dark:divide-adobe-line">
          {Array.from({ length: linhas }).map((_, i) => (
            <SkeletonTableRow key={i} cols={colunas} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Navegação de mês (setas + mês) usada em Metas, Financeiro e Bugs & Melhorias. */
export function SkeletonMes() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-9 w-9 rounded-lg" />
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-9 w-9 rounded-lg" />
    </div>
  )
}

/** Bloco de formulário em seções (campos em grade com rótulo). */
export function SkeletonForm({ campos = 6, colunas = 2 }: { campos?: number; colunas?: 1 | 2 | 3 }) {
  const grade = colunas === 3 ? 'sm:grid-cols-3' : colunas === 2 ? 'sm:grid-cols-2' : ''
  return (
    <div className={cn(CARD, 'p-5 md:p-6')}>
      <Skeleton className="mb-5 h-5 w-48" />
      <div className={cn('grid gap-4', grade)}>
        {Array.from({ length: campos }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Faixa do cabeçalho do site público (logo à esquerda, botões à direita). */
export function SkeletonPublicHeader() {
  return (
    <div className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
        <Skeleton className="h-10 w-28" />
        <div className="flex items-center gap-2 sm:gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg sm:w-44" />
          <Skeleton className="h-9 w-20 rounded-lg sm:w-36" />
        </div>
      </div>
    </div>
  )
}
