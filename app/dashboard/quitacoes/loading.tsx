import { Skeleton, SkeletonHeader, SkeletonPage, SkeletonRows } from '@/app/components/ui'

/** Quitações: busca + situação, botões de lote/terceiro e a lista de veículos com foto. */
export default function QuitacoesLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Skeleton className="h-10 w-full rounded-xl sm:w-72" />
          <div className="flex gap-1.5">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-36 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-56 rounded-lg" />
          <Skeleton className="h-10 w-44 rounded-lg" />
        </div>
      </div>
      <SkeletonRows linhas={5} miniatura selos={2} />
    </SkeletonPage>
  )
}
