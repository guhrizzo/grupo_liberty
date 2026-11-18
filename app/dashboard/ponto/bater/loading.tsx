import { Skeleton, SkeletonPage } from '@/app/components/ui'

/** Bater ponto: migalhas, título e o cartão do dia com o botão. */
export default function BaterPontoLoading() {
  return (
    <SkeletonPage>
      <Skeleton className="hidden h-3 w-40 md:block" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-72 w-full max-w-md rounded-xl" />
      <Skeleton className="h-12 w-full max-w-md rounded-lg" />
    </SkeletonPage>
  )
}
