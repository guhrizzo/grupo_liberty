import { Skeleton, SkeletonPage, SkeletonRows, SkeletonToolbar } from '@/app/components/ui'

/** Seguro: migalhas, título/subtítulo, filtros e a lista de veículos com a situação do seguro. */
export default function SeguroLoading() {
  return (
    <SkeletonPage>
      <Skeleton className="hidden h-3 w-40 md:block" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-[30rem] max-w-full" />
      </div>
      <SkeletonToolbar chips={3} />
      <SkeletonRows linhas={6} miniatura selos={1} />
    </SkeletonPage>
  )
}
