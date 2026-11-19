import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import { paraVeiculoContrato } from '../veiculos-para-contrato'
import ReciboPageClient from './ReciboPageClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Recibo de pagamento | Liberty Car',
  description: 'Gere o recibo do pagamento recebido por um veículo, com os dados do cliente e do veículo.',
}

export default async function ReciboPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'contratos')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const veiculos = (await getVehicles()).map(paraVeiculoContrato)
  return <ReciboPageClient veiculos={veiculos} />
}
