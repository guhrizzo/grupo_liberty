import { Skeleton, SkeletonHeader, SkeletonPage, SkeletonRows } from '@/app/components/ui'

/** Bugs & Melhorias: "Novo report", resumo do mês (navegação + 4 células) e a lista de reports. */
export default function FeedbackLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader acoes={['w-36']} />
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-line">
        <div className="flex items-center justify-between gap-2 bg-white px-4 py-3 adobe-dark:bg-adobe-bg-2">
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="mx-2 h-5 w-36" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="mt-px grid grid-cols-2 gap-px lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 bg-white p-4 adobe-dark:bg-adobe-bg-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-7 w-10" />
            </div>
          ))}
        </div>
      </section>
      <SkeletonRows linhas={5} selos={3} acao={false} />
    </SkeletonPage>
  )
}
