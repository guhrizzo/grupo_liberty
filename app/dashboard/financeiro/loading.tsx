import {
  Skeleton,
  SkeletonHeader,
  SkeletonPage,
  SkeletonStats,
  SkeletonTable,
  SkeletonTabs,
} from '@/app/components/ui'

/** Financeiro: abas, seletor de mês, resumo do mês e a tabela de lançamentos. */
export default function FinanceiroLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader acoes={['w-44']} />
      <SkeletonTabs itens={3} />
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <div className="flex gap-1">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-44 rounded-lg" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      <SkeletonStats itens={4} />
      <SkeletonTable colunas={6} linhas={7} />
    </SkeletonPage>
  )
}
