import { notFound, redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import { TIPOS_CONTRATO_GERADO } from '../types'
import { paraVeiculoContrato } from '../veiculos-para-contrato'
import ContratoPageClient from './ContratoPageClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ modelo: string }> }) {
  const { modelo } = await params
  const tipo = TIPOS_CONTRATO_GERADO.find((t) => t.value === modelo)
  return { title: `${tipo?.label ?? 'Contrato'} | Liberty Car`, description: tipo?.descricao }
}

export default async function ContratoPage({ params }: { params: Promise<{ modelo: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'contratos')) {
    redirect('/dashboard?error=acesso_negado')
  }

  // O endereço usa o valor do modelo (ex.: /dashboard/contratos/gerar/locacao-de-veiculo).
  const { modelo } = await params
  const tipo = TIPOS_CONTRATO_GERADO.find((t) => t.value === modelo)
  if (!tipo) notFound()

  const veiculos = (await getVehicles()).map(paraVeiculoContrato)
  return <ContratoPageClient tipo={tipo.value} veiculos={veiculos} />
}
