import { Skeleton, SkeletonHeader, SkeletonPage, SkeletonRows } from '@/app/components/ui'

/** Checklist pós-compra: busca + situação e a lista de veículos com foto. */
export default function ChecklistPosCompraLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-10 w-full rounded-xl sm:w-72" />
        <Skeleton className="h-9 w-64 rounded-lg" />
      </div>
      <SkeletonRows linhas={5} miniatura selos={2} />
    </SkeletonPage>
  )
}
