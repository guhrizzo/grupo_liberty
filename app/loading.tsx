import { Skeleton, SkeletonCard, SkeletonPublicHeader } from './components/ui'

/** Site público (home): cabeçalho, capa arredondada com título e botões, números e a grade do estoque. */
export default function Loading() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Carregando">
      <SkeletonPublicHeader />
      <main className="flex-1 overflow-x-clip px-4 py-10 md:px-8 md:py-16">
        <div className="mx-auto max-w-7xl space-y-12 md:space-y-16">
          <section className="rounded-3xl border border-neutral-200 bg-white shadow-lg shadow-liberty/5 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
            <div className="mx-auto max-w-3xl space-y-5 px-6 py-14 text-center md:px-16 md:py-20">
              <Skeleton className="mx-auto h-7 w-52 rounded-full" />
              <div className="space-y-3">
                <Skeleton className="mx-auto h-10 w-full max-w-xl md:h-14" />
                <Skeleton className="mx-auto h-10 w-3/4 max-w-md md:h-14" />
              </div>
              <Skeleton className="mx-auto h-4 w-full max-w-lg" />
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Skeleton className="h-12 w-36 rounded-xl" />
                <Skeleton className="h-12 w-48 rounded-xl" />
                <Skeleton className="h-12 w-40 rounded-xl" />
              </div>
              <div className="mx-auto grid max-w-xl grid-cols-3 gap-6 border-t border-neutral-200 pt-8 adobe-dark:border-adobe-line">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="mx-auto h-6 w-12" />
                    <Skeleton className="mx-auto h-2.5 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-56" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl sm:w-72" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
