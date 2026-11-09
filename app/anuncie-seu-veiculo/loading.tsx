import { Skeleton, SkeletonPublicHeader } from '@/app/components/ui'

/** Anuncie seu veículo: cabeçalho, título centralizado, 3 vantagens e o formulário. */
export default function AnuncieLoading() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Carregando">
      <SkeletonPublicHeader />
      <main className="px-4 py-10 md:px-8 md:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 space-y-3 text-center">
            <Skeleton className="mx-auto h-7 w-40 rounded-full" />
            <Skeleton className="mx-auto h-10 w-3/4 md:h-12" />
            <Skeleton className="mx-auto h-4 w-full max-w-xl" />
          </div>
          <div className="mb-8 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
          <div className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
              ))}
            </div>
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  )
}
