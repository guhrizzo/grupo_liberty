import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess, isAdmSupremo } from '@/utils/permissions'
import {
  getProcessos,
  getClientesPorVeiculo,
  getAnotacoesContagem,
  getContratosEnviadosJuridico,
} from './actions'
import { getVehicles } from '@/app/dashboard/veiculos/actions'
import { getProspeccoes } from './prospeccao-actions'
import JuridicoClient from './JuridicoClient'
import type { AbaJuridico } from './types'

export const metadata = {
  title: 'Jurídico | Liberty Car',
  description: 'Gestão de processos e documentos jurídicos.',
}

export default async function JuridicoPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string | string[] }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  if (!hasPageAccess(user, 'juridico')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const { aba: abaParam } = await searchParams
  const abaBruta = Array.isArray(abaParam) ? abaParam[0] : abaParam
  const aba: AbaJuridico =
    abaBruta === 'prospeccao' ? 'prospeccao' : abaBruta === 'contratos' ? 'contratos' : 'processos'
  const emProcessos = aba === 'processos'
  // A aba Contratos recebidos também abre o formulário de processo ("Registrar
  // como processo"), que precisa de veículos e clientes.
  const comFormulario = aba !== 'prospeccao'

  // Cada aba só carrega os próprios dados.
  const [
    initialProcessos,
    veiculos,
    clientesPorVeiculo,
    initialContagem,
    contratosJuridico,
    prospeccoes,
  ] = await Promise.all([
    emProcessos ? getProcessos() : Promise.resolve([]),
    comFormulario ? getVehicles() : Promise.resolve([]),
    comFormulario ? getClientesPorVeiculo() : Promise.resolve({}),
    getAnotacoesContagem(),
    // Sempre: o contador da aba Contratos recebidos aparece em todas as abas.
    getContratosEnviadosJuridico(),
    aba === 'prospeccao' ? getProspeccoes() : Promise.resolve([]),
  ])

  return (
    <JuridicoClient
      aba={aba}
      currentRole={user.role ?? ''}
      currentUid={user.uid}
      initialProcessos={initialProcessos}
      veiculos={veiculos}
      clientesPorVeiculo={clientesPorVeiculo}
      initialContagem={initialContagem}
      contratosJuridico={contratosJuridico}
      initialProspeccoes={prospeccoes}
      podeGerarProposta={hasPageAccess(user, 'propostas')}
      podeExcluirVisitas={isAdmSupremo(user)}
    />
  )
}
