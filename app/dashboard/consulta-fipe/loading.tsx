import { Skeleton, SkeletonHeader, SkeletonPage } from '@/app/components/ui'

/** Consulta FIPE: título/subtítulo, campo de placa com botão e a área do resultado. */
export default function ConsultaFipeLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <div className="mx-auto max-w-2xl space-y-5 py-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
          <Skeleton className="h-2.5 w-24" />
          <div className="mt-3 flex gap-3">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 w-32 rounded-xl" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2"
            >
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  )
}
