import { Skeleton, SkeletonHeader, SkeletonPage, SkeletonRows } from '@/app/components/ui'

/** Propostas de veículos (site): filtros por status, atalhos à direita e lista de propostas. */
export default function PropostasLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-lg" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-9 w-44 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>
      <SkeletonRows linhas={4} />
    </SkeletonPage>
  )
}
