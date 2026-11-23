import { Skeleton, SkeletonCard, SkeletonPublicHeader } from '@/app/components/ui'

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando estoque de veículos">
      <SkeletonPublicHeader />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-10 md:px-8 md:py-16">
        <Skeleton className="h-10 w-64 max-w-full" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  )
}
