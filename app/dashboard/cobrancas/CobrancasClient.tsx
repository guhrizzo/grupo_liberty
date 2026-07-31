'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  IconPlus,
  IconReceipt,
  IconHome,
  IconCheck,
  IconX,
  IconChevronDown,
  IconChevronUp,
  IconTrash,
  IconClock,
  IconAlertTriangle,
  IconCurrencyDollar,
  IconCircleCheck,
  IconCircleX,
  IconCar,
  IconCalendar,
} from '@tabler/icons-react'
import {
  Breadcrumb,
  Button,
  Input,
  Select,
  ConfirmDialog,
  useToast,
} from '@/app/components/ui'
import { formatCurrency, formatDate } from '@/utils/format'
import { maskMoney, parseMoney } from '@/utils/masks'
import type { Cobranca, Parcela, TipoCobranca } from './actions'
import { criarCobranca, toggleParcela, deletarCobranca } from './actions'
import type { Veiculo } from '@/app/dashboard/veiculos/actions'
import { useRouter } from 'next/navigation'
import { VeiculoPicker } from './VeiculoPicker'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CobrancasClientProps {
  cobrancas: Cobranca[]
  veiculos: Veiculo[]
  currentRole: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mesLabel(anoMes: string): string {
  const [ano, mes] = anoMes.split('-')
  const data = new Date(Number(ano), Number(mes) - 1, 1)
  return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function badgeTipo(tipo: TipoCobranca) {
  if (tipo === 'quinzenal')
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-liberty/10 text-liberty-deep border border-liberty/30">
        <IconCalendar size={11} stroke={2.5} />
        Quinzenal
      </span>
    )
  const isAluguel = tipo === 'aluguel'
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ' +
        (isAluguel
          ? 'bg-liberty/10 text-liberty-deep border border-liberty/30'
          : 'bg-liberty text-white border border-liberty-deep shadow-sm')
      }
    >
      {isAluguel ? (
        <IconHome size={11} stroke={2.5} />
      ) : (
        <IconReceipt size={11} stroke={2.5} />
      )}
      {isAluguel ? 'Aluguel' : 'Promissória'}
    </span>
  )
}

function labelParcelas(tipo: TipoCobranca): string {
  if (tipo === 'aluguel') return 'Nº de Semanas *'
  if (tipo === 'quinzenal') return 'Nº de Parcelas Quinzenais *'
  return 'Nº de Parcelas *'
}

function labelPrimeiraParcela(tipo: TipoCobranca): string {
  if (tipo === 'aluguel') return 'Data da 1ª Semana *'
  if (tipo === 'quinzenal') return 'Data da 1ª Parcela Quinzenal *'
  return 'Data da 1ª Parcela *'
}

function periodicidadeLabel(tipo: TipoCobranca): string {
  if (tipo === 'aluguel') return '(semanais)'
  if (tipo === 'quinzenal') return '(quinzenais)'
  return '(mensais)'
}

function StatusBadge({ status }: { status: Parcela['status'] }) {
  if (status === 'pago')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        <IconCheck size={10} stroke={3} /> Pago
      </span>
    )
  if (status === 'atrasado')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        <IconAlertTriangle size={10} stroke={2.5} /> Atrasado
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
      <IconClock size={10} stroke={2.5} /> Pendente
    </span>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CobrancasClient({ cobrancas, veiculos, currentRole }: CobrancasClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [isPending, startTransition] = useTransition()

  // Modal nova cobrança
  const [showModal, setShowModal] = useState(false)
  const [loadingForm, setLoadingForm] = useState(false)

  // Form fields
  const [clienteNome, setClienteNome] = useState('')
  const [veiculoId, setVeiculoId] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [valorEntrada, setValorEntrada] = useState('')
  const [numeroParcelas, setNumeroParcelas] = useState('1')
  const [diaVencimento, setDiaVencimento] = useState('1')
  const [tipo, setTipo] = useState<TipoCobranca>('promissoria')
  const [primeiraParcela, setPrimeiraParcela] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Veículo picker
  const [showVeiculoPicker, setShowVeiculoPicker] = useState(false)

  // Painel expandido de parcelas
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Confirmação de exclusão
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Extrato mensal expandido
  const [expandedMes, setExpandedMes] = useState<string | null>(null)

  // ─── Métricas ──────────────────────────────────────────────────────────────

  const todasParcelas = useMemo(() => cobrancas.flatMap((c) => c.parcelas), [cobrancas])

  const totalRecebido = useMemo(
    () => todasParcelas.filter((p) => p.pago).reduce((a, p) => a + p.valorParcela, 0),
    [todasParcelas]
  )
  const totalPendente = useMemo(
    () => todasParcelas.filter((p) => !p.pago).reduce((a, p) => a + p.valorParcela, 0),
    [todasParcelas]
  )
  const totalAtrasado = useMemo(
    () => todasParcelas.filter((p) => p.status === 'atrasado').reduce((a, p) => a + p.valorParcela, 0),
    [todasParcelas]
  )

  // ─── Extrato por mês ───────────────────────────────────────────────────────

  const extratoMensal = useMemo(() => {
    const map = new Map<string, Parcela[]>()
    for (const p of todasParcelas) {
      const mes = p.dataVencimento.slice(0, 7) // YYYY-MM
      const list = map.get(mes) ?? []
      list.push(p)
      map.set(mes, list)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, parcelas]) => ({
        mes,
        parcelas,
        totalPago: parcelas.filter((p) => p.pago).reduce((a, p) => a + p.valorParcela, 0),
        totalPendente: parcelas.filter((p) => !p.pago).reduce((a, p) => a + p.valorParcela, 0),
      }))
  }, [todasParcelas])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const resetForm = () => {
    setClienteNome('')
    setVeiculoId('')
    setValorTotal('')
    setValorEntrada('')
    setNumeroParcelas('1')
    setDiaVencimento('1')
    setTipo('promissoria')
    setPrimeiraParcela(new Date().toISOString().split('T')[0])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingForm(true)
    try {
      const veiculo = veiculos.find((v) => v.id === veiculoId)
      const veiculoResumo = veiculo
        ? `${veiculo.marca} ${veiculo.modelo} ${veiculo.ano}${veiculo.placa ? ` • ${veiculo.placa}` : ''}`
        : 'Veículo não especificado'

      const fd = new FormData()
      fd.append('clienteNome', clienteNome)
      fd.append('veiculoId', veiculoId)
      fd.append('veiculoResumo', veiculoResumo)
      fd.append('valorTotal', String(parseMoney(valorTotal) || 0))
      fd.append('valorEntrada', String(parseMoney(valorEntrada) || 0))
      fd.append('numeroParcelas', numeroParcelas)
      fd.append('diaVencimento', diaVencimento)
      fd.append('tipo', tipo)
      fd.append('primeiraParcela', primeiraParcela)

      const result = await criarCobranca(fd)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success || 'Cobrança cadastrada!')
        resetForm()
        setShowModal(false)
        router.refresh()
      }
    } finally {
      setLoadingForm(false)
    }
  }

  const handleToggle = (parcelaId: string, pagoAtual: boolean) => {
    startTransition(async () => {
      const result = await toggleParcela(parcelaId, !pagoAtual)
      if (result.error) toast.error(result.error)
      else router.refresh()
    })
  }

  const handleDelete = async () => {
    if (!deleteId) return
    startTransition(async () => {
      const result = await deletarCobranca(deleteId)
      if (result.error) toast.error(result.error)
      else {
        toast.success('Cobrança removida.')
        router.refresh()
      }
      setDeleteId(null)
    })
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Cobranças' }]} />
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950">
            Gestão de Cobranças
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Controle de aluguéis e promissórias, parcelas e pagamentos.
          </p>
        </div>
        {currentRole === 'admin' && (
          <Button
            variant="liberty"
            leftIcon={<IconPlus size={16} stroke={2.5} />}
            onClick={() => setShowModal(true)}
          >
            Nova Cobrança
          </Button>
        )}
      </div>

      {/* ─── Cards de Resumo ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
              Total a Receber
            </span>
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <IconCurrencyDollar size={20} stroke={2} />
            </div>
          </div>
          <p className="text-2xl font-black text-neutral-950">{formatCurrency(totalPendente)}</p>
          <p className="mt-1 text-xs text-neutral-500">{todasParcelas.filter((p) => !p.pago).length} parcelas pendentes</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
              Total Recebido
            </span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IconCircleCheck size={20} stroke={2} />
            </div>
          </div>
          <p className="text-2xl font-black text-neutral-950">{formatCurrency(totalRecebido)}</p>
          <p className="mt-1 text-xs text-neutral-500">{todasParcelas.filter((p) => p.pago).length} parcelas pagas</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
              Em Atraso
            </span>
            <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <IconCircleX size={20} stroke={2} />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600">{formatCurrency(totalAtrasado)}</p>
          <p className="mt-1 text-xs text-neutral-500">{todasParcelas.filter((p) => p.status === 'atrasado').length} parcelas vencidas</p>
        </div>
      </div>

      {/* ─── Lista de Cobranças ───────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">
          Cobranças Cadastradas ({cobrancas.length})
        </h2>

        {cobrancas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center">
              <IconReceipt size={24} stroke={1.5} className="text-neutral-400" />
            </div>
            <p className="text-sm font-medium text-neutral-500">Nenhuma cobrança cadastrada</p>
            <p className="text-xs text-neutral-400 mt-1">Clique em &quot;Nova Cobrança&quot; para começar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cobrancas.map((c) => {
              const pagas = c.parcelas.filter((p) => p.pago).length
              const totalPago = c.parcelas.filter((p) => p.pago).reduce((a, p) => a + p.valorParcela, 0)
              const isExpanded = expandedId === c.id
              const percentual = c.valorTotal > 0 ? (totalPago / c.valorTotal) * 100 : 0

              return (
                <div key={c.id} className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
                  {/* Cabeçalho do card */}
                  <div
                    className="p-5 cursor-pointer hover:bg-neutral-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-base font-bold text-neutral-900">{c.clienteNome}</span>
                          {badgeTipo(c.tipo)}
                        </div>
                        <p className="text-sm text-neutral-500 truncate">{c.veiculoResumo}</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {currentRole === 'admin' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDeleteId(c.id) }}
                            className="rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <IconTrash size={14} stroke={2} />
                          </button>
                        )}
                        <div className="text-neutral-400">
                          {isExpanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                        </div>
                      </div>
                    </div>

                    {/* Progresso */}
                    <div className="mt-4 space-y-2">
                      {c.valorEntrada && c.valorEntrada > 0 && (
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="inline-flex items-center rounded-full bg-liberty/10 text-liberty-deep border border-liberty/30 px-2 py-0.5 font-bold uppercase tracking-wider">
                            Entrada
                          </span>
                          <span className="font-bold text-neutral-900">{formatCurrency(c.valorEntrada)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-neutral-600">
                          Pago: <span className="text-emerald-700 font-bold">{formatCurrency(totalPago)}</span>{' '}
                          de <span className="font-bold text-neutral-900">{formatCurrency(c.valorTotal)}</span>
                        </span>
                        <span className="text-neutral-400">
                          {pagas}/{c.numeroParcelas} parcelas
                        </span>
                      </div>
                      <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(percentual, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Painel de parcelas */}
                  {isExpanded && (
                    <div className="border-t border-neutral-100">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                            <tr>
                              <th className="px-5 py-3">Parcela</th>
                              <th className="px-5 py-3">Vencimento</th>
                              <th className="px-5 py-3">Valor</th>
                              <th className="px-5 py-3">Status</th>
                              <th className="px-5 py-3 text-center">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100">
                            {c.parcelas.map((p) => (
                              <tr key={p.id} className={`transition-colors ${p.pago ? 'bg-emerald-50/30' : p.status === 'atrasado' ? 'bg-rose-50/30' : ''}`}>
                                <td className="px-5 py-3 font-bold text-neutral-700">
                                  {p.numeroParcela}ª
                                </td>
                                <td className="px-5 py-3 text-neutral-600">
                                  {new Date(p.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </td>
                                <td className="px-5 py-3 font-bold text-neutral-900">
                                  {formatCurrency(p.valorParcela)}
                                </td>
                                <td className="px-5 py-3">
                                  <StatusBadge status={p.status} />
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => handleToggle(p.id, p.pago)}
                                    title={p.pago ? 'Marcar como não pago' : 'Marcar como pago'}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                                      p.pago
                                        ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    }`}
                                  >
                                    {p.pago ? (
                                      <><IconX size={11} stroke={2.5} /> Desmarcar</>
                                    ) : (
                                      <><IconCheck size={11} stroke={2.5} /> Pago</>
                                    )}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Extrato Mensal ──────────────────────────────────────────── */}
      {extratoMensal.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">
            Extrato por Mês
          </h2>
          <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden divide-y divide-neutral-100">
            {extratoMensal.map(({ mes, parcelas, totalPago, totalPendente: pendMes }) => {
              const isOpen = expandedMes === mes
              return (
                <div key={mes}>
                  <button
                    type="button"
                    onClick={() => setExpandedMes(isOpen ? null : mes)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-neutral-900 capitalize">{mesLabel(mes)}</span>
                      <span className="text-xs text-neutral-400">{parcelas.length} parcelas</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Recebido</p>
                        <p className="text-sm font-black text-emerald-700">{formatCurrency(totalPago)}</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Pendente</p>
                        <p className="text-sm font-black text-amber-600">{formatCurrency(pendMes)}</p>
                      </div>
                      <div className="text-neutral-400">
                        {isOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-neutral-100 bg-neutral-50/50">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                          <tr>
                            <th className="px-6 py-2.5">Cliente / Veículo</th>
                            <th className="px-6 py-2.5">Vencimento</th>
                            <th className="px-6 py-2.5">Valor</th>
                            <th className="px-6 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {parcelas
                            .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
                            .map((p) => {
                              const cob = cobrancas.find((c) => c.id === p.cobrancaId)
                              return (
                                <tr key={p.id} className="hover:bg-white transition-colors">
                                  <td className="px-6 py-3">
                                    <span className="font-semibold text-neutral-800">{cob?.clienteNome ?? '—'}</span>
                                    {cob && <span className="text-neutral-400 ml-2">{cob.veiculoResumo}</span>}
                                  </td>
                                  <td className="px-6 py-3 text-neutral-600">
                                    {new Date(p.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                                  </td>
                                  <td className="px-6 py-3 font-bold text-neutral-900">
                                    {formatCurrency(p.valorParcela)}
                                  </td>
                                  <td className="px-6 py-3">
                                    <StatusBadge status={p.status} />
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Modal Nova Cobrança ─────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 p-6 w-full max-w-lg space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <h3 className="text-base font-bold text-neutral-900">Nova Cobrança</h3>
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm() }}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <IconX size={20} stroke={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                  Tipo de Cobrança *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'promissoria', label: 'Mensal', icon: IconReceipt },
                    { value: 'quinzenal', label: 'Quinzenal', icon: IconCalendar },
                    { value: 'aluguel', label: 'Semanal', icon: IconHome },
                  ] as { value: TipoCobranca; label: string; icon: React.ComponentType<{ size?: number; stroke?: number }> }[]).map(({ value: t, label, icon: IconTipo }) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipo(t)}
                      className={
                        'inline-flex items-center justify-center gap-1.5 rounded-xl border-2 py-3 text-xs font-bold transition-all cursor-pointer ' +
                        (tipo === t
                          ? 'border-liberty bg-liberty text-white shadow-sm'
                          : 'border-neutral-200 text-neutral-500 hover:border-liberty/40 hover:text-liberty-deep bg-white')
                      }
                    >
                      <IconTipo size={14} stroke={2.5} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cliente */}
              <Input
                id="clienteNome"
                label="Nome do Cliente *"
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                placeholder="Nome completo"
                autoComplete="off"
                required
              />

              {/* Veículo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                    Veículo *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowVeiculoPicker(true)}
                    className="text-[11px] font-bold uppercase tracking-wider text-liberty-deep hover:text-liberty transition-colors cursor-pointer"
                  >
                    {veiculoId ? 'Trocar' : 'Selecionar'}
                  </button>
                </div>
                {veiculoId ? (() => {
                  const v = veiculos.find((x) => x.id === veiculoId)
                  if (!v) return (
                    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-xs text-neutral-500">
                      Veículo não encontrado.
                    </div>
                  )
                  const foto = Array.isArray(v.fotos) && v.fotos.length > 0 ? v.fotos[0] : null
                  return (
                    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-xs">
                      <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                        {foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={foto} alt={`${v.marca} ${v.modelo}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-neutral-400">
                            <IconCar size={20} stroke={1.5} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-neutral-900">
                          {v.marca} {v.modelo}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-neutral-500">
                          {v.ano}{v.placa ? ` • ${v.placa}` : ''}
                        </p>
                      </div>
                    </div>
                  )
                })() : (
                  <button
                    type="button"
                    onClick={() => setShowVeiculoPicker(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3.5 py-6 text-xs font-semibold text-neutral-500 hover:border-liberty/40 hover:bg-liberty/5 hover:text-liberty-deep transition-colors cursor-pointer"
                  >
                    <IconCar size={16} stroke={2} />
                    Selecionar veículo
                  </button>
                )}
                <input type="hidden" required value={veiculoId} onChange={() => {}} />
              </div>

              {/* Valor e parcelas */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="valorTotal"
                  label="Valor Total *"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(maskMoney(e.target.value))}
                  placeholder="R$ 0,00"
                  inputMode="numeric"
                  required
                />
                <Input
                  id="valorEntrada"
                  label="Entrada (opcional)"
                  value={valorEntrada}
                  onChange={(e) => setValorEntrada(maskMoney(e.target.value))}
                  placeholder="R$ 0,00"
                  inputMode="numeric"
                />
              </div>

              <div>
                <Input
                  id="numeroParcelas"
                  label={labelParcelas(tipo)}
                  type="number"
                  min="1"
                  max="120"
                  value={numeroParcelas}
                  onChange={(e) => setNumeroParcelas(e.target.value)}
                  required
                />
              </div>

              {/* Dia vencimento e primeira parcela */}
              <div className="grid grid-cols-2 gap-4">
                {tipo === 'promissoria' && (
                  <Input
                    id="diaVencimento"
                    label="Dia do Vencimento *"
                    type="number"
                    min="1"
                    max="31"
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(e.target.value)}
                    required
                  />
                )}
                <Input
                  id="primeiraParcela"
                  label={labelPrimeiraParcela(tipo)}
                  type="date"
                  value={primeiraParcela}
                  onChange={(e) => setPrimeiraParcela(e.target.value)}
                  containerClassName={tipo === 'aluguel' || tipo === 'quinzenal' ? 'col-span-2' : ''}
                  required
                />
              </div>

              {/* Preview do valor da parcela */}
              {valorTotal && numeroParcelas && (() => {
                const totalNum = parseMoney(valorTotal) || 0
                const entradaNum = parseMoney(valorEntrada) || 0
                const saldo = Math.max(totalNum - entradaNum, 0)
                const n = Number(numeroParcelas) || 1
                const valorParcelaCalc = saldo / n
                const temEntrada = entradaNum > 0
                return (
                  <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-sm space-y-1">
                    <p className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Prévia</p>
                    {temEntrada && (
                      <p className="text-xs text-neutral-600">
                        Entrada: <span className="font-bold text-neutral-900">{formatCurrency(entradaNum)}</span>
                        <span className="text-neutral-400"> · Saldo: </span>
                        <span className="font-bold text-neutral-900">{formatCurrency(saldo)}</span>
                      </p>
                    )}
                    <p className="font-bold text-neutral-900">
                      {numeroParcelas}× de{' '}
                      <span className="text-emerald-700">{formatCurrency(valorParcelaCalc)}</span>{' '}
                      {periodicidadeLabel(tipo)}
                    </p>
                    {temEntrada && (
                      <p className="text-[11px] text-neutral-500">
                        Total: {formatCurrency(entradaNum + valorParcelaCalc * n)}
                      </p>
                    )}
                  </div>
                )
              })()}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm() }}
                  className="flex-1 rounded-xl border border-neutral-200 bg-white py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingForm}
                  className="flex-1 rounded-xl bg-neutral-950 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loadingForm ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <VeiculoPicker
        open={showVeiculoPicker}
        onClose={() => setShowVeiculoPicker(false)}
        veiculos={veiculos.map((v) => ({
          id: v.id,
          marca: v.marca,
          modelo: v.modelo,
          ano: v.ano ?? null,
          placa: v.placa ?? null,
          foto: Array.isArray(v.fotos) && v.fotos.length > 0 ? v.fotos[0] : null,
        }))}
        value={veiculoId || null}
        onSelect={setVeiculoId}
      />

      {/* ─── Confirm Delete ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteId}
        title="Remover Cobrança"
        description="Tem certeza? Todas as parcelas serão excluídas permanentemente."
        confirmLabel="Sim, remover"
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
        loading={isPending}
        tone="danger"
      />
    </div>
  )
}
