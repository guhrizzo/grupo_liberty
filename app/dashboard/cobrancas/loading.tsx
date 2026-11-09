import {
  Skeleton,
  SkeletonHeader,
  SkeletonPage,
  SkeletonRows,
  SkeletonTabs,
} from '@/app/components/ui'

const CARD =
  'rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs md:p-5 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2'

/** Cobranças: 3 botões no topo, abas, KPIs (1 grande + 3 empilhados), vencimentos e a lista. */
export default function CobrancasLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader acoes={['w-36', 'w-28', 'w-40']} />
      <SkeletonTabs itens={3} />

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className={CARD}>
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="mt-3 h-9 w-48" />
          <Skeleton className="mt-2 h-3 w-24" />
          <Skeleton className="mt-6 h-3 w-full rounded-full" />
          <div className="mt-3 flex gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={CARD}>
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="mt-2 h-6 w-32" />
            </div>
          ))}
        </div>
      </section>

      <section className={CARD}>
        <Skeleton className="h-2.5 w-52" />
        <Skeleton className="mt-2 h-4 w-40" />
        <div className="mt-3 divide-y divide-neutral-100 adobe-dark:divide-adobe-line">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <Skeleton className="h-7 w-10" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-10 rounded-lg" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg sm:w-96" />
        </div>
        <SkeletonRows linhas={5} selos={2} />
      </section>
    </SkeletonPage>
  )
}
