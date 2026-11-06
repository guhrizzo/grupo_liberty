import Link from 'next/link'
import { redirect } from 'next/navigation'
import { IconAlertTriangle, IconExternalLink, IconMap2 } from '@tabler/icons-react'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { listarPosicoes, type PosicaoAutocarsat } from '@/utils/autocarsat/client'
import { ESTADOS, estadoDoVeiculo, formatarEvento } from '@/utils/autocarsat/formatar'
import { Breadcrumb, Card } from '@/app/components/ui'
import { AtualizarAuto } from '@/app/components/rastreamento/AtualizarAuto'

export const metadata = {
  title: 'Rastreamento | Liberty Car',
  description: 'Última posição dos veículos rastreados no Autocarsat.',
}

// Posições ao vivo: nunca cachear.
export const dynamic = 'force-dynamic'

function Linha({ p }: { p: PosicaoAutocarsat }) {
  const estado = estadoDoVeiculo(p)
  const evento = formatarEvento(p.date_time_event)
  const temCoord = Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold tracking-tight text-neutral-950 adobe-dark:text-white">
            {p.placa || 'Sem placa'}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-700 adobe-dark:bg-white/10 adobe-dark:text-neutral-200"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: ESTADOS[estado].cor }} aria-hidden="true" />
            {ESTADOS[estado].rotulo}
          </span>
          {!p.gps_valido && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              GPS sem sinal
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-neutral-500">{p.modelo || '—'}</p>
        <p className="mt-1 truncate text-sm text-neutral-800 adobe-dark:text-neutral-200">
          {p.localization || 'Endereço indisponível'}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-6 text-sm">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Velocidade</p>
          <p className="font-semibold text-neutral-900 adobe-dark:text-white">{Math.round(Number(p.speed) || 0)} km/h</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Último sinal</p>
          <p className={`font-semibold ${evento.antigo ? 'text-rose-600' : 'text-neutral-900 adobe-dark:text-white'}`}>
            {evento.texto}
          </p>
        </div>
        {temCoord && (
          <a
            href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-liberty hover:underline"
          >
            Mapa
            <IconExternalLink size={14} aria-hidden="true" />
          </a>
        )}
      </div>
    </Card>
  )
}

export default async function RastreamentoPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!hasPageAccess(user, 'rastreamento')) {
    redirect('/dashboard?error=acesso_negado')
  }

  const r = await listarPosicoes()
  const posicoes = r.ok ? [...r.data].sort((a, b) => (a.placa ?? '').localeCompare(b.placa ?? '')) : []
  const ligados = posicoes.filter((p) => p.ignition === 'ON').length

  return (
    <div className="space-y-6">
      <AtualizarAuto segundos={30} />
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Rastreamento' }]} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 adobe-dark:text-white">Rastreamento</h1>
          {r.ok && (
            <p className="mt-1 text-sm text-neutral-500">
              {posicoes.length} {posicoes.length === 1 ? 'veículo' : 'veículos'} · {ligados} ligado
              {ligados === 1 ? '' : 's'} · atualiza a cada 30 s
            </p>
          )}
        </div>
        <Link
          href="/mapa-rastreamento"
          className="inline-flex items-center gap-2 rounded-lg bg-liberty px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-liberty-deep"
        >
          <IconMap2 size={18} aria-hidden="true" />
          Abrir mapa
        </Link>
      </div>

      {!r.ok && (
        <Card className="flex max-w-2xl items-start gap-3 border-amber-300 p-4 text-sm">
          <IconAlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-semibold text-neutral-900 adobe-dark:text-white">
              Não foi possível carregar o rastreamento.
            </p>
            <p className="mt-1 text-neutral-500">{r.error}</p>
          </div>
        </Card>
      )}

      {r.ok && posicoes.length === 0 && (
        <Card className="max-w-2xl border-dashed py-12 text-center text-sm text-neutral-500">
          Nenhum veículo retornado pelo Autocarsat.
        </Card>
      )}

      {r.ok && posicoes.length > 0 && (
        <div className="space-y-3">
          {posicoes.map((p) => (
            <Linha key={p.uuid} p={p} />
          ))}
        </div>
      )}
    </div>
  )
}
