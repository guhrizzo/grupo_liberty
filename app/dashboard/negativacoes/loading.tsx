import { Skeleton, SkeletonPage, SkeletonRows } from '@/app/components/ui'

/** Negativações: título/subtítulo e as listas "Em andamento" e "Cobranças vencidas". */
export default function NegativacoesLoading() {
  return (
    <SkeletonPage>
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-[34rem] max-w-full" />
      </div>
      {['w-36', 'w-64'].map((largura) => (
        <section key={largura} className="space-y-3">
          <Skeleton className={`h-4 ${largura}`} />
          <SkeletonRows linhas={2} selos={0} />
        </section>
      ))}
    </SkeletonPage>
  )
}
