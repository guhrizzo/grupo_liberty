import { Skeleton, SkeletonHeader, SkeletonPage } from '@/app/components/ui'

/** Novidades: título e, em coluna estreita, os meses recolhíveis com as novidades de cada um. */
export default function NovidadesLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <div className="max-w-2xl space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <section
            key={i}
            className="rounded-2xl border border-neutral-200 bg-white shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2"
          >
            <div className="flex items-center justify-between px-5 py-4 md:px-6">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-4" />
            </div>
            {i === 0 && (
              <div className="space-y-4 border-t border-neutral-100 px-5 py-4 md:px-6 adobe-dark:border-adobe-line">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </SkeletonPage>
  )
}
