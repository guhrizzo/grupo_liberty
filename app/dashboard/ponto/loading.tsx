import { Skeleton, SkeletonPage, SkeletonRows, SkeletonToolbar } from '@/app/components/ui'

/** Folha de ponto: migalhas, título, barra de mês/ações e a tabela de funcionários. */
export default function FolhaPontoLoading() {
  return (
    <SkeletonPage>
      <Skeleton className="hidden h-3 w-40 md:block" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>
      <SkeletonToolbar chips={1} direita={3} />
      <SkeletonRows linhas={6} selos={2} />
    </SkeletonPage>
  )
}
