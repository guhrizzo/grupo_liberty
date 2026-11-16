import { Skeleton, SkeletonHeader, SkeletonPage } from '@/app/components/ui'

/** Contrato gerado: cabeçalho, seletor de abas e formulário. */
export default function ContratoLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Skeleton className="h-60 w-full rounded-xl" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    </SkeletonPage>
  )
}
