import { Skeleton, SkeletonHeader, SkeletonPage } from '@/app/components/ui'

/** Escolha do modelo de contrato: cabeçalho e cartões. */
export default function EscolherModeloLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-52 w-full rounded-2xl" />
        ))}
      </div>
    </SkeletonPage>
  )
}
