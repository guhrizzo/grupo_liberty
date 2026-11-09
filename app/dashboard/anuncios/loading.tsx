import { Skeleton, SkeletonHeader, SkeletonPage } from '@/app/components/ui'

/** Anúncios de terceiros: filtros + busca, contagem e cartões grandes com dados do anunciante. */
export default function AnunciosLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-9 w-64 rounded-lg" />
      </div>
      <Skeleton className="h-3 w-48" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2"
          >
            <div className="mb-4 flex flex-col justify-between gap-4 border-b border-neutral-100 pb-4 md:flex-row md:items-center adobe-dark:border-adobe-line">
              <div className="space-y-2">
                <Skeleton className="h-2.5 w-36" />
                <Skeleton className="h-5 w-48" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-28 rounded-lg" />
                <Skeleton className="h-9 w-28 rounded-lg" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="space-y-2">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  )
}
