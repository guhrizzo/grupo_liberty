import { Skeleton, SkeletonPage, SkeletonStats, SkeletonTable } from '@/app/components/ui'

/** Visitantes: rótulo + título + subtítulo, 4 cartões, gráfico de visitantes e a tabela de páginas. */
export default function AnalyticsLoading() {
  return (
    <SkeletonPage>
      <div className="space-y-2">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-[32rem] max-w-full" />
      </div>
      <SkeletonStats itens={4} className="sm:grid-cols-2 lg:grid-cols-4" />
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
      <SkeletonTable colunas={4} linhas={6} />
    </SkeletonPage>
  )
}
