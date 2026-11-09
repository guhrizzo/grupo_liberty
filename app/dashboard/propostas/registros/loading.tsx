import {
  Skeleton,
  SkeletonHeader,
  SkeletonPage,
  SkeletonRows,
  SkeletonStats,
} from '@/app/components/ui'

/** Propostas registradas: resumo em 3 cards, filtros e a lista de registros. */
export default function PropostasRegistradasLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader acoes={['w-40', 'w-36']} />
      <SkeletonStats itens={3} className="sm:grid-cols-2 lg:grid-cols-3" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-10 w-full rounded-lg sm:w-72" />
        <Skeleton className="h-9 w-72 rounded-lg" />
      </div>
      <SkeletonRows linhas={6} />
    </SkeletonPage>
  )
}
