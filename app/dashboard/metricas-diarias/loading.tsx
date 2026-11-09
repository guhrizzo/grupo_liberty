import { Skeleton, SkeletonPage, SkeletonTable } from '@/app/components/ui'

/** Métricas diárias: formulário "Meus números do dia" (data + 6 campos) e a tabela do mês. */
export default function MetricasDiariasLoading() {
  return (
    <SkeletonPage>
      <Skeleton className="hidden h-3 w-40 md:block" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-[30rem] max-w-full" />
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs md:p-5 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-4 h-10 w-32 rounded-lg" />
      </div>
      <SkeletonTable colunas={8} linhas={6} />
    </SkeletonPage>
  )
}
