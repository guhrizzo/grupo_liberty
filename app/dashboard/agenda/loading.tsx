import { Skeleton, SkeletonHeader, SkeletonPage, SkeletonRows } from '@/app/components/ui'

/** Agenda: "Novo compromisso", cartão de conexão com o Google, filtros e a lista de compromissos. */
export default function AgendaLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader acoes={['w-48']} />
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full max-w-md" />
        </div>
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 w-72 rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
      <SkeletonRows linhas={5} selos={2} acao={false} />
    </SkeletonPage>
  )
}
