import { Skeleton, SkeletonPage } from '@/app/components/ui'

/** Rastreamento: título com "Abrir mapa" e um cartão por veículo (nome, velocidade e último sinal). */
export default function RastreamentoLoading() {
  return (
    <SkeletonPage>
      <Skeleton className="hidden h-3 w-40 md:block" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <div className="flex gap-6">
              <div className="space-y-2">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-4 w-14" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  )
}
