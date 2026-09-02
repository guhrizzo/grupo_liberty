import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { redirect } from 'next/navigation'
import ContratosClient from './ContratosClient'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import { listarTodosContratosVeiculoAction } from '@/app/veiculos/[id]/actions'
import { listarCategoriasContrato } from './categorias.actions'

export const dynamic = 'force-dynamic'

export default async function ContratosPage() {
  const session = await getSessionUser()

  if (!session) {
    redirect('/login')
  }

  if (!hasPageAccess(session, 'contratos', ['admin', 'advogado', 'vendedor'])) {
    redirect('/dashboard?error=acesso_negado')
  }

  // Lista veículos para o filtro de busca
  const veiculosList = await getVehicles()
  const veiculos = veiculosList.map((v) => ({
    id: v.id,
    marca: v.marca,
    modelo: v.modelo,
    ano: v.ano,
    placa: v.placa ?? '',
    preco: v.preco,
  }))

  // Lista todos os contratos anexados aos veículos (coleção `veiculo_contratos`).
  // A página /dashboard/contratos agora é apenas visualização — geração desativada.
  const veiculoContratos = await listarTodosContratosVeiculoAction()
  const categorias = await listarCategoriasContrato()
  const veiculoMarcas = new Map(veiculosList.map((v) => [v.id, v]))
  const contratos = veiculoContratos.map((c) => {
    const v = veiculoMarcas.get(c.veiculoId)
    return {
      id: c.id,
      veiculoId: c.veiculoId,
      veiculoResumo:
        (v ? `${v.marca ?? ''} ${v.modelo ?? ''} ${v.ano ?? ''}`.trim() : '') ||
        c.fileName,
      veiculoMarca: v?.marca ?? '',
      veiculoModelo: v?.modelo ?? '',
      veiculoAno: v?.ano ?? null,
      veiculoPlaca: v?.placa ?? null,
      veiculoChassi: null,
      veiculoCor: v?.cor ?? null,
      veiculoQuilometragem: v?.quilometragem ?? null,
      veiculoLocalizacao: v?.localizacao ?? null,
      clienteNome: c.clienteNome ?? c.uploadedByEmail ?? '—',
      clienteCpfCnpj: '',
      clienteEndereco: '',
      clienteEmail: null,
      clienteTelefone: null,
      valor: 0,
      formaPagamento: '',
      dataEmissao: c.uploadedAt.slice(0, 10),
      clausulasExtras: c.descricao ?? '',
      observacoesInternas: '',
      status: 'ativo' as const,
      categoriaId: c.categoriaId ?? null,
      categoriaNome: c.categoriaNome ?? null,
      storagePath: c.storagePath,
      criadoPorUid: c.uploadedByUid,
      criadoPorEmail: c.uploadedByEmail,
      criadoEm: c.uploadedAt,
      atualizadoEm: c.uploadedAt,
    }
  })

  return (
    <ContratosClient
      initialContratos={contratos}
      veiculos={veiculos}
      userRole={session.role}
      categorias={categorias}
      isAdmin={session.role === 'admin'}
    />
  )
}
