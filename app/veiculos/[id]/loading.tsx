import { Skeleton, SkeletonPublicHeader } from '@/app/components/ui'

/** Página pública do veículo: cabeçalho, galeria 16:9 + ficha à esquerda e o cartão de proposta fixo à direita. */
export default function VeiculoDetalheLoading() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Carregando">
      <SkeletonPublicHeader />
      <main className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-3 w-48" />
          <div className="grid items-start gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Skeleton className="aspect-16/9 w-full rounded-2xl" />
              <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-24 shrink-0 rounded-lg" />
                ))}
              </div>
              <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-2/3 md:h-10" />
                <Skeleton className="h-4 w-1/3" />
                <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-6 lg:sticky lg:top-24">
              <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-11 w-full rounded-xl" />
                <Skeleton className="h-11 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
