import { Skeleton, SkeletonPage, SkeletonTable } from '@/app/components/ui'

/** Controle de Acessos: título com "Cadastrar colaborador" e a tabela de usuários em largura total. */
export default function UsuariosLoading() {
  return (
    <SkeletonPage>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <Skeleton className="hidden h-3 w-48 md:block" />
          <Skeleton className="h-9 w-72" />
        </div>
        <Skeleton className="h-10 w-56 rounded-lg" />
      </div>
      <SkeletonTable colunas={5} linhas={7} />
    </SkeletonPage>
  )
}
