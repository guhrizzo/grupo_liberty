import { Skeleton, SkeletonPage, SkeletonRows, SkeletonToolbar } from '@/app/components/ui'

/** Interesses: migalhas, título/subtítulo, filtros com "Novo interesse" e a lista de clientes. */
export default function InteressesLoading() {
  return (
    <SkeletonPage>
      <Skeleton className="hidden h-3 w-40 md:block" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-[30rem] max-w-full" />
      </div>
      <SkeletonToolbar chips={3} direita={1} />
      <SkeletonRows linhas={5} selos={2} />
    </SkeletonPage>
  )
}
