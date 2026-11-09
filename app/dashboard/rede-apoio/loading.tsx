import { Skeleton, SkeletonPage, SkeletonRows, SkeletonToolbar } from '@/app/components/ui'

/** Rede de apoio: migalhas, título/subtítulo, busca com "Novo contato" e a lista de contatos. */
export default function RedeApoioLoading() {
  return (
    <SkeletonPage>
      <Skeleton className="hidden h-3 w-40 md:block" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-[30rem] max-w-full" />
      </div>
      <SkeletonToolbar chips={2} direita={1} />
      <SkeletonRows linhas={6} selos={1} />
    </SkeletonPage>
  )
}
