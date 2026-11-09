import {
  Skeleton,
  SkeletonHeader,
  SkeletonPage,
  SkeletonRows,
  SkeletonStats,
} from '@/app/components/ui'

/** Demandas: abas, resumo em 4 cards e, ao lado da lista de tarefas, o cartão de afazeres. */
export default function DemandasLoading() {
  return (
    <SkeletonPage>
      <div className="flex w-fit gap-1.5 rounded-lg border border-neutral-200 bg-white p-1 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-24 rounded-md" />
        <Skeleton className="h-7 w-32 rounded-md" />
      </div>
      <SkeletonHeader acoes={['w-36']} />
      <SkeletonStats itens={4} />
      <div className="grid gap-5 md:gap-6 xl:grid-cols-4 xl:gap-3">
        <div className="min-w-0 space-y-5 xl:col-span-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-48 rounded-lg" />
            <Skeleton className="h-9 w-64 rounded-lg" />
          </div>
          <SkeletonRows linhas={4} selos={2} />
        </div>
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full rounded-lg" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  )
}
