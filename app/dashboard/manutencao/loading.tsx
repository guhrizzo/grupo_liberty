import {
  Skeleton,
  SkeletonPage,
  SkeletonTable,
  SkeletonToolbar,
} from '@/app/components/ui'

const CARD =
  'rounded-xl border border-neutral-200 bg-white shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2'

/** Manutenção: custo baixado (card grande) + 3 contadores, filtros e a tabela de ordens. */
export default function ManutencaoLoading() {
  return (
    <SkeletonPage>
      <Skeleton className="hidden h-3 w-40 md:block" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-44 rounded-lg" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${CARD} p-5 md:p-6`}>
          <Skeleton className="h-2.5 w-36" />
          <Skeleton className="mt-3 h-10 w-52" />
          <Skeleton className="mt-2 h-3 w-48" />
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-200 pt-4 adobe-dark:border-adobe-line">
            <div className="space-y-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-rows-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${CARD} flex items-center justify-between px-5 py-3`}>
              <Skeleton className="h-2.5 w-28" />
              <Skeleton className="h-6 w-8" />
            </div>
          ))}
        </div>
      </div>

      <SkeletonToolbar chips={4} direita={1} />
      <SkeletonTable colunas={7} linhas={6} />
    </SkeletonPage>
  )
}
