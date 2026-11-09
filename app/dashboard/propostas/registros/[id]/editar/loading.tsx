import { SkeletonForm, SkeletonHeader, SkeletonPage } from '@/app/components/ui'

/** Editar proposta registrada: cliente, veículo, pendências, parcelas e valores. */
export default function EditarPropostaLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader acoes={['w-32']} />
      <SkeletonForm campos={6} colunas={2} />
      <SkeletonForm campos={6} colunas={3} />
      <SkeletonForm campos={4} colunas={2} />
    </SkeletonPage>
  )
}
