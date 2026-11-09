import { Skeleton, SkeletonPage, SkeletonTable } from '@/app/components/ui'

/** Contratos: migalhas soltas no topo, título com 2 botões, modelos e a tabela de contratos. */
export default function ContratosLoading() {
  return (
    <SkeletonPage>
      <Skeleton className="hidden h-3 w-40 md:block" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-44 rounded-lg" />
        </div>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <Skeleton className="h-5 w-52" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <SkeletonTable colunas={5} linhas={6} />
    </SkeletonPage>
  )
}
