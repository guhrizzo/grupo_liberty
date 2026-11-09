import {
  SkeletonHeader,
  SkeletonMes,
  SkeletonPage,
  SkeletonRows,
  SkeletonStats,
} from '@/app/components/ui'

/** Metas: botões de vendedores/nova meta, navegação de mês, resumo e os cartões de meta. */
export default function MetasLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader acoes={['w-40', 'w-32']} />
      <SkeletonMes />
      <SkeletonStats itens={4} />
      <SkeletonRows linhas={4} selos={1} acao={false} />
    </SkeletonPage>
  )
}
