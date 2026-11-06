import Link from 'next/link'
import { redirect } from 'next/navigation'
import { IconAlertTriangle, IconArrowLeft } from '@tabler/icons-react'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { listarPosicoes } from '@/utils/autocarsat/client'
import { estadoDoVeiculo, formatarEvento } from '@/utils/autocarsat/formatar'
import { AtualizarAuto } from '@/app/components/rastreamento/AtualizarAuto'
import type { PontoMapa } from '@/app/components/rastreamento/MapaRastreamento'
import PainelMapa from './PainelMapa'

export const metadata = {
  title: 'Mapa de rastreamento | Liberty Car',
}

// Mapa em tela cheia, sem a sidebar do dashboard (fica fora de app/dashboard,
// então não herda aquele layout). Mesmo acesso da aba Rastreamento.
export const dynamic = 'force-dynamic'

function nomeMotorista(m: unknown): string {
  if (m && typeof m === 'object' && 'nome' in m && typeof (m as { nome: unknown }).nome === 'string') {
    return (m as { nome: string }).nome
  }
  return ''
}

export default async function MapaRastreamentoPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!hasPageAccess(user, 'rastreamento')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const r = await listarPosicoes()

  if (!r.ok) {
    return (
      <div className="min-h-dvh bg-white p-6">
        <Link
          href="/dashboard/rastreamento"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-500 hover:text-neutral-900"
        >
          <IconArrowLeft size={14} aria-hidden="true" />
          Voltar
        </Link>
        <div className="mt-6 flex max-w-xl items-start gap-3 rounded-xl border border-amber-300 bg-white p-5 text-sm">
          <IconAlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-semibold text-neutral-900">Não foi possível carregar o rastreamento.</p>
            <p className="mt-1 text-neutral-500">{r.error}</p>
          </div>
        </div>
      </div>
    )
  }

  const pontos: PontoMapa[] = r.data
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    .map((p) => ({
      uuid: p.uuid,
      placa: p.placa ?? '',
      modelo: p.modelo ?? '',
      lat: p.latitude,
      lng: p.longitude,
      estado: estadoDoVeiculo(p),
      velocidade: Number(p.speed) || 0,
      ultimoSinal: formatarEvento(p.date_time_event).texto,
      endereco: p.localization ?? '',
      tensao: p.tensao_modulo != null && Number.isFinite(Number(p.tensao_modulo)) ? Number(p.tensao_modulo) : null,
      hodometro: p.hodometro ?? '',
      motorista: nomeMotorista(p.motorista),
      angulo: typeof p.north_angle === 'number' ? p.north_angle : null,
    }))
    .sort((a, b) => a.placa.localeCompare(b.placa))

  return (
    <>
      <AtualizarAuto segundos={30} />
      <PainelMapa pontos={pontos} />
    </>
  )
}
