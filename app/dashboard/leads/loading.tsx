import { Skeleton, SkeletonPage, SkeletonRows, SkeletonToolbar } from '@/app/components/ui'

/** Leads: migalhas, título/subtítulo e a lista de prospecção (busca, filtros e cartões). */
export default function LeadsLoading() {
  return (
    <SkeletonPage>
      <Skeleton className="hidden h-3 w-40 md:block" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>
      <Skeleton className="h-5 w-40" />
      <SkeletonToolbar chips={3} direita={1} />
      <SkeletonRows linhas={6} selos={2} />
    </SkeletonPage>
  )
}
