import { Skeleton, SkeletonPage } from '@/app/components/ui'

/** QR do ponto: migalhas, título e o quadro do QR. */
export default function QrPontoLoading() {
  return (
    <SkeletonPage>
      <Skeleton className="hidden h-3 w-56 md:block" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="mx-auto aspect-square w-full max-w-xl rounded-2xl" />
    </SkeletonPage>
  )
}
