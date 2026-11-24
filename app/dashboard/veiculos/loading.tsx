import { Skeleton, SkeletonHeader, SkeletonPage } from '@/app/components/ui'
import ListaSkeleton from './ListaSkeleton'

/** Veículos: cabeçalho com "Novo Veículo", filtros e ordenação do estoque e a lista no modo salvo (blocos ou lista). */
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
            <Skeleton className="h-10 w-full rounded-xl sm:w-64" />
            <Skeleton className="h-10 w-24 rounded-xl" />
          </div>
        </div>
        <ListaSkeleton />
      </div>
    </SkeletonPage>
  )
}
