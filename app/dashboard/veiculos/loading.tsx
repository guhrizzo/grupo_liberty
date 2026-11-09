import { Skeleton, SkeletonCard, SkeletonHeader, SkeletonPage } from '@/app/components/ui'

/** Veículos: cabeçalho com "Novo Veículo", filtros do estoque e grade de cards com foto 16:9. */
export default function VeiculosLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader subtitle={false} acoes={['w-40']} />
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-4 w-72 max-w-full" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-10 w-full rounded-xl sm:w-64" />
            <Skeleton className="h-10 w-full rounded-xl sm:w-44" />
            <Skeleton className="h-10 w-24 rounded-xl" />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </SkeletonPage>
  )
}
