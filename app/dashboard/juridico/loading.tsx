import {
  Skeleton,
  SkeletonPage,
  SkeletonTable,
  SkeletonTabs,
  SkeletonToolbar,
} from '@/app/components/ui'

/** Jurídico: título com Anotações/Novo Processo, abas e a tabela de processos. */
export default function JuridicoLoading() {
  return (
    <SkeletonPage>
      <Skeleton className="hidden h-3 w-40 md:block" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
      </div>
      <SkeletonTabs itens={3} />
      <SkeletonToolbar chips={4} />
      <SkeletonTable colunas={6} linhas={6} />
    </SkeletonPage>
  )
}
