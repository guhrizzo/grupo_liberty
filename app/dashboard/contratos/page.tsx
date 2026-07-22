import { getSessionUser } from '@/utils/permissions'
import { redirect } from 'next/navigation'
import ContratosClient from './ContratosClient'
import { listarContratos } from './actions'
import { getVehicles } from '@/app/dashboard/veiculos/actions'

export const dynamic = 'force-dynamic'

export default async function ContratosPage() {
  const session = await getSessionUser()

  if (!session) {
    redirect('/login')
  }

  // Busca lista de veículos disponíveis para o formulário de emissão
  const veiculosList = await getVehicles()
  const veiculos = veiculosList.map((v) => ({
    id: v.id,
    marca: v.marca,
    modelo: v.modelo,
    ano: v.ano,
    placa: v.placa ?? '',
    preco: v.preco,
  }))

  const contratos = await listarContratos()

  return <ContratosClient initialContratos={contratos} veiculos={veiculos} userRole={session.role} />
}
