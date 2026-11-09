import { Skeleton, SkeletonHeader, SkeletonPage, SkeletonStats } from '@/app/components/ui'

/** Visão Geral: cabeçalho, números do mês e os gráficos de faturamento, custos e lucro. */
export default function DashboardLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <SkeletonStats itens={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2"
          >
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-52 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  )
}
