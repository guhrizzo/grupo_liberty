import { Skeleton, SkeletonForm, SkeletonHeader, SkeletonPage } from '@/app/components/ui'

/** Nova proposta: barra de preenchimento e seções recolhíveis (a primeira aberta). */
export default function NovaPropostaLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <div className="mb-2 flex items-center justify-between">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <SkeletonForm campos={6} colunas={2} />
      <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs adobe-dark:divide-adobe-line adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-4">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-4" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  )
}
