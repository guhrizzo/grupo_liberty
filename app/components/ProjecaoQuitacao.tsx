'use client'

import { useMemo } from 'react'
import {
  IconCalculator,
  IconCalendarStats,
  IconCash,
  IconTrendingUp,
  IconClock,
  IconInfoCircle,
} from '@tabler/icons-react'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/utils/cn'
import { projetarQuitacao } from '@/utils/financing'

export interface ProjecaoQuitacaoProps {
  /** Valor cheio do veículo (R$). */
  valorVeiculo: number | null | undefined
  /** Entrada (R$). */
  entrada: number | null | undefined
  /** Taxa em % (não fração). */
  taxaPercent: number | null | undefined
  /** Em qual periodicidade a `taxaPercent` foi informada. */
  taxaPeriodicidade: 'mensal' | 'anual'
  /** Prazo em meses. */
  prazoMeses: number | null | undefined
  className?: string
}

export default function ProjecaoQuitacao({
  valorVeiculo,
  entrada,
  taxaPercent,
  taxaPeriodicidade,
  prazoMeses,
  className,
}: ProjecaoQuitacaoProps) {
  const projecao = useMemo(() => {
    return projetarQuitacao({
      valorVeiculo: Number(valorVeiculo) || 0,
      entrada: Number(entrada) || 0,
      taxaPercent: Number(taxaPercent) || 0,
      taxaPeriodicidade,
      prazoMeses: Number(prazoMeses) || 0,
    })
  }, [valorVeiculo, entrada, taxaPercent, taxaPeriodicidade, prazoMeses])

  const temValor = (Number(valorVeiculo) || 0) > 0
  const temPrazo = (Number(prazoMeses) || 0) > 0
  const temTaxa = (Number(taxaPercent) || 0) > 0

  if (!temValor || !temPrazo) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 p-5 text-sm text-neutral-500',
          className,
        )}
      >
        <div className="flex items-start gap-2">
          <IconInfoCircle size={16} className="mt-0.5 shrink-0 text-neutral-400" stroke={2} />
          <p className="leading-snug">
            Preencha <strong>valor do veículo</strong> e <strong>parcelas restantes</strong>{' '}
            para ver a projeção de quitação.
          </p>
        </div>
      </div>
    )
  }

  const valorFinanciado = Math.max(0, (Number(valorVeiculo) || 0) - (Number(entrada) || 0))
  const ratioJuros =
    projecao.totalPago > 0 ? (projecao.totalJuros / projecao.totalPago) * 100 : 0

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white shadow-xs',
        className,
      )}
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-emerald-100 bg-white/70 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <IconCalculator size={15} stroke={2.2} />
          </span>
          <div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">
              Projeção de Quitação
            </h4>
            <p className="text-[11px] text-neutral-500">Tabela Price · ao vivo</p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          {taxaPeriodicidade === 'anual' ? 'Taxa a.a.' : 'Taxa a.m.'}
        </span>
      </div>

      {/* Grid de métricas */}
      <div className="grid grid-cols-2 gap-px bg-emerald-100/60 sm:grid-cols-4">
        <Metric
          label="Parcela"
          value={projecao.parcelaMensal}
          icon={<IconCash size={14} stroke={2} />}
          highlight
          sub={`${projecao.prazoMeses}x`}
        />
        <Metric
          label="Valor financiado"
          value={valorFinanciado}
          icon={<IconTrendingUp size={14} stroke={2} />}
          sub={
            (Number(entrada) || 0) > 0
              ? `entrada ${formatCurrency(Number(entrada) || 0)}`
              : 'sem entrada'
          }
        />
        <Metric
          label="Total a pagar"
          value={projecao.custoEfetivoTotal}
          icon={<IconCalendarStats size={14} stroke={2} />}
        />
        <Metric
          label="Juros totais"
          value={projecao.totalJuros}
          icon={<IconClock size={14} stroke={2} />}
          warn={ratioJuros > 25}
        />
      </div>

      {/* Rodapé explicativo */}
      <div className="space-y-1 px-4 py-3 text-[11px] leading-relaxed text-neutral-600">
        {!temTaxa && (
          <p className="flex items-start gap-1.5 text-amber-700">
            <IconInfoCircle size={12} stroke={2.2} className="mt-0.5 shrink-0" />
            Sem taxa informada — exibindo parcela sem juros.
          </p>
        )}
        <p>
          {projecao.prazoMeses} parcelas de{' '}
          <strong>{formatCurrency(projecao.parcelaMensal)}</strong> · quitação em
          aproximadamente <strong>{Math.ceil(projecao.prazoMeses / 12)} ano(s)</strong>.
        </p>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  icon,
  highlight,
  warn,
  sub,
}: {
  label: string
  value: number
  icon: React.ReactNode
  highlight?: boolean
  warn?: boolean
  sub?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 bg-white px-3 py-3',
        highlight && 'bg-emerald-50/40',
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          'text-base font-bold tabular-nums sm:text-lg',
          warn ? 'text-rose-600' : highlight ? 'text-emerald-700' : 'text-neutral-900',
        )}
      >
        {formatCurrency(value)}
      </div>
      {sub && <div className="text-[10px] text-neutral-500">{sub}</div>}
    </div>
  )
}
