import { redirect } from 'next/navigation'
import { getSessionUser } from '@/utils/permissions'
import { Breadcrumb } from '@/app/components/ui'
import { validarTokenPonto } from '@/utils/ponto/token'
import { proximaBatida } from '@/utils/ponto/calculo'
import { hojeSaoPaulo } from '@/utils/cobrancas/encargos'
import { getMeuDia, pontoDigitalDisponivel } from './actions'
import BaterPontoClient from './BaterPontoClient'

export const metadata = {
  title: 'Bater ponto | Liberty Car',
  description: 'Registre sua entrada, almoço e saída escaneando o QR code da empresa.',
}

export default async function BaterPontoPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { t } = await searchParams
  const segredo = process.env.PONTO_QR_SECRET ?? ''
  const tokenValido = !!t && validarTokenPonto(t, segredo)

  const dia = await getMeuDia()
  const hoje = hojeSaoPaulo()

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Bater ponto' }]} />

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Bater ponto</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Escaneie o QR code da tela da empresa para registrar o horário.
        </p>
      </div>

      <BaterPontoClient
        hoje={hoje}
        batidas={dia?.batidas ?? {}}
        proxima={proximaBatida(dia?.batidas ?? {})}
        token={t ?? null}
        tokenValido={tokenValido}
        digitalDisponivel={await pontoDigitalDisponivel()}
        nome={user.name ?? user.email ?? ''}
      />
    </div>
  )
}
