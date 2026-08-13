'use client'

import { useState, useTransition, useMemo, useCallback, useEffect } from 'react'
import {
  IconPlus,
  IconReceipt,
  IconHome,
  IconCheck,
  IconX,
  IconChevronDown,
  IconTrash,
  IconClock,
  IconAlertTriangle,
  IconCurrencyDollar,
  IconCircleCheck,
  IconCircleX,
  IconCar,
  IconCalendar,
  IconSearch,
  IconFilter,
  IconUser,
  IconCoin,
  IconCalculator,
  IconCalendarEvent,
  IconHash,
  IconChevronRight,
  IconStack2,
  IconMail,
  IconBell,
  IconBellOff,
  IconBellRinging,
  IconPencil,
  IconLoader2,
  IconSend,
  IconEdit,
  IconHistory,
} from '@tabler/icons-react'
import {
  Breadcrumb,
  Button,
  Input,
  useToast,
} from '@/app/components/ui'
import { formatCurrency, formatDate } from '@/utils/format'
import { maskMoney, parseMoney } from '@/utils/masks'
import type { Cobranca, Parcela, Pagamento, TipoCobranca } from './actions'
import {
  criarCobranca,
  registrarPagamento,
  removerPagamento,
  resetParcela,
  deletarCobranca,
  atualizarLembrete,
  editarCobranca,
  testarLembretes,
  enviarEmailCobranca,
  editarValorParcela,
} from './actions'
import type { Veiculo } from '@/app/dashboard/veiculos/actions'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { VeiculoPicker } from './VeiculoPicker'

interface CobrancasClientProps {
  cobrancas: Cobranca[]
  veiculos: Veiculo[]
  currentRole: string | null
  currentUserName: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mesLabel(anoMes: string): string {
  const [ano, mes] = anoMes.split('-')
  const data = new Date(Number(ano), Number(mes) - 1, 1)
  return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function ehVendedor(role: string | null): boolean {
  return role === 'admin' || role === 'vendedor'
}

/** Cobrança quite = todas as parcelas já pagas (fila terminada). */
function isCobrancaQuite(c: Cobranca): boolean {
  return c.parcelas.length > 0 && c.parcelas.every((p) => p.pago)
}

function labelParcelas(tipo: TipoCobranca): string {
  if (tipo === 'aluguel') return 'Nº de Semanas *'
  if (tipo === 'quinzenal') return 'Nº de Parcelas Quinzenais *'
  return 'Nº de Parcelas Mensais *'
}

function labelPrimeiraParcela(tipo: TipoCobranca): string {
  if (tipo === 'aluguel') return 'Data da 1ª Semana *'
  if (tipo === 'quinzenal') return 'Data da 1ª Parcela Quinzenal *'
  return 'Data da 1ª Parcela *'
}

function periodicidadeLabel(tipo: TipoCobranca): string {
  if (tipo === 'aluguel') return 'semanais'
  if (tipo === 'quinzenal') return 'quinzenais'
  return 'mensais'
}

function badgeTipo(tipo: TipoCobranca) {
  if (tipo === 'quinzenal') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-liberty/30 bg-liberty/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-liberty-deep">
        <IconCalendar size={11} stroke={2.5} />
        Quinzenal
      </span>
    )
  }
  if (tipo === 'aluguel') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-liberty/30 bg-liberty/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-liberty-deep">
        <IconHome size={11} stroke={2.5} />
        Semanal
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-liberty-deep/30 bg-liberty text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-xs">
      <IconReceipt size={11} stroke={2.5} />
      Mensal
    </span>
  )
}

function StatusBadge({ status }: { status: Parcela['status'] }) {
  if (status === 'pago') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
        <IconCheck size={10} stroke={3} /> Pago
      </span>
    )
  }
  if (status === 'parcial') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">
        <IconCoin size={10} stroke={2.5} /> Parcial
      </span>
    )
  }
  if (status === 'atrasado') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
        <IconAlertTriangle size={10} stroke={2.5} /> Atrasado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
      <IconClock size={10} stroke={2.5} /> Pendente
    </span>
  )
}

function TipoPillSelect({
  value,
  onChange,
}: {
  value: TipoCobranca
  onChange: (t: TipoCobranca) => void
}) {
  const items: { value: TipoCobranca; label: string; icon: React.ComponentType<{ size?: number; stroke?: number }> }[] = [
    { value: 'promissoria', label: 'Mensal', icon: IconReceipt },
    { value: 'quinzenal', label: 'Quinzenal', icon: IconCalendar },
    { value: 'aluguel', label: 'Semanal', icon: IconHome },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ value: t, label, icon: IconTipo }) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          aria-pressed={value === t}
          className={
            'inline-flex items-center justify-center gap-1.5 rounded-xl border-2 py-3 text-xs font-bold transition-all cursor-pointer ' +
            (value === t
              ? 'border-liberty bg-liberty text-white shadow-sm'
              : 'border-neutral-200 bg-white text-neutral-500 hover:border-liberty/40 hover:text-liberty-deep')
          }
        >
          <IconTipo size={14} stroke={2.5} />
          {label}
        </button>
      ))}
    </div>
  )
}

function MoneyHint({ value }: { value: string }) {
  const n = value.trim() ? parseMoney(value) : null
  if (n == null || n <= 0) return null
  return (
    <p className="mt-1 text-[11px] font-semibold text-liberty-deep">
      {formatCurrency(n)}
    </p>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CobrancasClient({ cobrancas, veiculos, currentRole, currentUserName }: CobrancasClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [isPending, startTransition] = useTransition()

  const canEdit = ehVendedor(currentRole)

  // ─── UI state ──────────────────────────────────────────────────────────────

  const [showModal, setShowModal] = useState(false)
  const [loadingForm, setLoadingForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showVeiculoPicker, setShowVeiculoPicker] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expandedMes, setExpandedMes] = useState<string | null>(null)
  const [pagamentoParcela, setPagamentoParcela] = useState<Parcela | null>(null)
  const [loadingPagamento, setLoadingPagamento] = useState(false)
  const [lembreteCobranca, setLembreteCobranca] = useState<Cobranca | null>(null)
  const [loadingLembrete, setLoadingLembrete] = useState(false)
  const [testandoLembretes, startTesteLembretes] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [enviandoEmailId, setEnviandoEmailId] = useState<string | null>(null)
  const [editarValorParcelaData, setEditarValorParcelaData] = useState<Parcela | null>(null)
  const [loadingEditarValor, setLoadingEditarValor] = useState(false)
  const [editarCobrancaData, setEditarCobrancaData] = useState<Cobranca | null>(null)
  const [loadingEditar, setLoadingEditar] = useState(false)

  // Filtros da lista
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState<'todos' | TipoCobranca>('todos')
  const [filterStatus, setFilterStatus] = useState<'todas' | 'em-dia' | 'atrasadas' | 'quites'>('todas')

  // Form
  const [clienteNome, setClienteNome] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [veiculoId, setVeiculoId] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [valorEntrada, setValorEntrada] = useState('')
  const [numeroParcelas, setNumeroParcelas] = useState('1')
  const [diaVencimento, setDiaVencimento] = useState('1')
  const [tipo, setTipo] = useState<TipoCobranca>('promissoria')
  const [primeiraParcela, setPrimeiraParcela] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Reset form quando o tipo muda (afeta labels), mas mantém primeiro valor
  useEffect(() => {
    if (tipo !== 'promissoria' && diaVencimento !== '1' && diaVencimento) {
      // mantém diaVencimento — usuário pode usar quinzenal/semanal com vencimento custom
    }
  }, [tipo, diaVencimento])

  // ─── Métricas ──────────────────────────────────────────────────────────────

  const todasParcelas = useMemo(() => cobrancas.flatMap((c) => c.parcelas), [cobrancas])

  const totalRecebido = useMemo(
    () => todasParcelas.reduce((a, p) => a + p.valorPago, 0),
    [todasParcelas],
  )
  const totalPendente = useMemo(
    () => todasParcelas.filter((p) => !p.pago).reduce((a, p) => a + p.valorRestante, 0),
    [todasParcelas],
  )
  const totalAtrasado = useMemo(
    () => todasParcelas.filter((p) => p.status === 'atrasado').reduce((a, p) => a + p.valorRestante, 0),
    [todasParcelas],
  )
  const totalGeral = useMemo(
    () => cobrancas.reduce((a, c) => a + c.valorTotal, 0),
    [cobrancas],
  )
  const totalPagoGeral = useMemo(
    () => cobrancas.reduce((a, c) => a + c.parcelas.reduce((s, p) => s + p.valorPago, 0), 0),
    [cobrancas],
  )
  const percentualGeralRecebido = totalGeral > 0 ? Math.min((totalPagoGeral / totalGeral) * 100, 100) : 0

  // Próximos vencimentos (7 dias)
  const proximosVencimentos = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const limite = new Date(hoje)
    limite.setDate(limite.getDate() + 7)
    return todasParcelas
      .filter((p) => !p.pago && p.status !== 'atrasado')
      .filter((p) => {
        const venc = new Date(p.dataVencimento + 'T00:00:00')
        return venc >= hoje && venc <= limite
      })
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
      .slice(0, 5)
  }, [todasParcelas])

  const cobrancasAtrasadas = useMemo(
    () => cobrancas.filter((c) => c.parcelas.some((p) => p.status === 'atrasado')).length,
    [cobrancas],
  )

  // ─── Filtros aplicados ─────────────────────────────────────────────────────

  const cobrancasFiltradas = useMemo(() => {
    let out = cobrancas
    const t = search.trim().toLowerCase()
    if (t) {
      out = out.filter(
        (c) =>
          c.clienteNome.toLowerCase().includes(t) ||
          c.veiculoResumo.toLowerCase().includes(t),
      )
    }
    if (filterTipo !== 'todos') {
      out = out.filter((c) => c.tipo === filterTipo)
    }
    if (filterStatus !== 'todas') {
      out = out.filter((c) => {
        const hasAtrasada = c.parcelas.some((p) => p.status === 'atrasado')
        const allPagas = c.parcelas.length > 0 && c.parcelas.every((p) => p.pago)
        if (filterStatus === 'atrasadas') return hasAtrasada
        if (filterStatus === 'quites') return allPagas
        if (filterStatus === 'em-dia') return !hasAtrasada && !allPagas
        return true
      })
    }

    // Quem já quitou todas as parcelas vai para o final da fila, em ordem
    // alfabética entre si. As demais mantêm a ordem original (sort é estável).
    return [...out].sort((a, b) => {
      const aQuite = isCobrancaQuite(a)
      const bQuite = isCobrancaQuite(b)
      if (aQuite !== bQuite) return aQuite ? 1 : -1
      if (aQuite && bQuite) return a.clienteNome.localeCompare(b.clienteNome, 'pt-BR')
      return 0
    })
  }, [cobrancas, search, filterTipo, filterStatus])

  const filtrosAtivos = filterTipo !== 'todos' || filterStatus !== 'todas' || search.length > 0

  // ─── Extrato por mês ───────────────────────────────────────────────────────

  const extratoMensal = useMemo(() => {
    const map = new Map<string, Parcela[]>()
    for (const p of todasParcelas) {
      const mes = p.dataVencimento.slice(0, 7)
      const list = map.get(mes) ?? []
      list.push(p)
      map.set(mes, list)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a)) // mais recente primeiro
      .map(([mes, parcelas]) => ({
        mes,
        parcelas,
        totalPago: parcelas.reduce((a, p) => a + p.valorPago, 0),
        totalPendente: parcelas.filter((p) => !p.pago).reduce((a, p) => a + p.valorRestante, 0),
        totalAtrasado: parcelas.filter((p) => p.status === 'atrasado').reduce((a, p) => a + p.valorRestante, 0),
      }))
  }, [todasParcelas])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setClienteNome('')
    setClienteEmail('')
    setVeiculoId('')
    setValorTotal('')
    setValorEntrada('')
    setNumeroParcelas('1')
    setDiaVencimento('1')
    setTipo('promissoria')
    setPrimeiraParcela(new Date().toISOString().split('T')[0])
  }, [])

  const openModal = useCallback(() => {
    resetForm()
    setShowModal(true)
  }, [resetForm])

  const closeModal = useCallback(() => {
    setShowModal(false)
    resetForm()
  }, [resetForm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nome = clienteNome.trim()
    if (!nome) {
      toast.error('Informe o nome do cliente.', 'Campo obrigatório')
      return
    }
    if (!veiculoId) {
      toast.error('Selecione um veículo.', 'Campo obrigatório')
      return
    }
    if (!valorTotal.trim()) {
      toast.error('Informe o valor total.', 'Campo obrigatório')
      return
    }
    if (!primeiraParcela) {
      toast.error('Informe a data da primeira parcela.', 'Campo obrigatório')
      return
    }

    setLoadingForm(true)
    try {
      const veiculo = veiculos.find((v) => v.id === veiculoId)
      const veiculoResumo = veiculo
        ? `${veiculo.marca} ${veiculo.modelo} ${veiculo.ano}${veiculo.placa ? ` • ${veiculo.placa}` : ''}`
        : 'Veículo não especificado'

      const fd = new FormData()
      fd.append('clienteNome', nome)
      fd.append('clienteEmail', clienteEmail.trim())
      fd.append('veiculoId', veiculoId)
      fd.append('veiculoResumo', veiculoResumo)
      fd.append('valorTotal', String(parseMoney(valorTotal) || 0))
      fd.append('valorEntrada', String(parseMoney(valorEntrada) || 0))
      fd.append('numeroParcelas', numeroParcelas)
      fd.append('diaVencimento', diaVencimento)
      fd.append('tipo', tipo)
      fd.append('primeiraParcela', primeiraParcela)
      fd.append('diasAvisoAntecedencia', '')
      fd.append('avisarAtraso', String(Boolean(clienteEmail.trim())))

      const result = await criarCobranca(fd)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success || 'Cobrança cadastrada!')
        closeModal()
        router.refresh()
      }
    } finally {
      setLoadingForm(false)
    }
  }

  const handleAbrirPagamento = useCallback((parcela: Parcela) => {
    setPagamentoParcela(parcela)
  }, [])

  const handleFecharPagamento = useCallback(() => {
    if (loadingPagamento) return
    setPagamentoParcela(null)
  }, [loadingPagamento])

  const handleSubmitPagamento = useCallback(
    async (valor: number, data: string) => {
      if (!pagamentoParcela) return
      setLoadingPagamento(true)
      try {
        const result = await registrarPagamento(pagamentoParcela.id, valor, data)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(result.success || 'Pagamento registrado!')
          setPagamentoParcela(null)
          router.refresh()
        }
      } finally {
        setLoadingPagamento(false)
      }
    },
    [pagamentoParcela, router, toast],
  )

  const handleDesfazerParcela = useCallback(
    (parcelaId: string) => {
      startTransition(async () => {
        const result = await resetParcela(parcelaId)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Pagamentos da parcela removidos.')
          router.refresh()
        }
      })
    },
    [router, toast],
  )

  const handleRemoverPagamento = useCallback(
    (pagamentoId: string) => {
      startTransition(async () => {
        const result = await removerPagamento(pagamentoId)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Pagamento removido.')
          router.refresh()
        }
      })
    },
    [router, toast],
  )

  const handleAbrirEditarValor = useCallback((parcela: Parcela) => {
    setEditarValorParcelaData(parcela)
  }, [])

  const handleFecharEditarValor = useCallback(() => {
    if (loadingEditarValor) return
    setEditarValorParcelaData(null)
  }, [loadingEditarValor])

  const handleSalvarEditarValor = useCallback(
    async (novoValor: number, motivo: string) => {
      if (!editarValorParcelaData) return
      setLoadingEditarValor(true)
      try {
        const result = await editarValorParcela(
          editarValorParcelaData.id,
          novoValor,
          currentUserName,
          motivo,
        )
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(result.success || 'Valor da parcela atualizado!')
          setEditarValorParcelaData(null)
          router.refresh()
        }
      } finally {
        setLoadingEditarValor(false)
      }
    },
    [editarValorParcelaData, currentUserName, router, toast],
  )

  const handleAbrirLembrete = useCallback((cobranca: Cobranca) => {
    setLembreteCobranca(cobranca)
  }, [])

  const handleFecharLembrete = useCallback(() => {
    if (loadingLembrete) return
    setLembreteCobranca(null)
  }, [loadingLembrete])

  const handleSalvarLembrete = useCallback(
    async (novoEmail: string, novosDias: number | null, novoAvisarAtraso: boolean) => {
      if (!lembreteCobranca) return
      setLoadingLembrete(true)
      try {
        // Atualiza o e-mail via editarCobranca (mantém nome e veículo)
        const result = await editarCobranca(lembreteCobranca.id, {
          clienteNome: lembreteCobranca.clienteNome,
          clienteEmail: novoEmail,
          veiculoId: lembreteCobranca.veiculoId,
          veiculoResumo: lembreteCobranca.veiculoResumo,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        // Se o e-mail foi salvo com sucesso e o avisarAtraso mudou, atualiza o toggle
        if (novoAvisarAtraso !== lembreteCobranca.avisarAtraso && novoEmail.trim()) {
          await atualizarLembrete(lembreteCobranca.id, novoAvisarAtraso)
        }
        toast.success('Lembrete salvo!')
        setLembreteCobranca(null)
        router.refresh()
      } finally {
        setLoadingLembrete(false)
      }
    },
    [lembreteCobranca, router, toast],
  )

  const handleTestarLembretes = useCallback(() => {
    startTesteLembretes(async () => {
      const result = await testarLembretes()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success || 'Lembretes verificados.')
      }
      router.refresh()
    })
  }, [router, toast])

  // Toggle direto do sino — ativa/desativa notificações sem abrir modal
  const handleToggleSino = useCallback(
    async (cobranca: Cobranca) => {
      if (togglingId) return
      if (!cobranca.clienteEmail) {
        // Não deve acontecer (sino fica disabled sem e-mail), mas por segurança:
        toast.error('Adicione o e-mail do cliente antes de ativar as notificações.')
        return
      }
      setTogglingId(cobranca.id)
      try {
        const result = await atualizarLembrete(cobranca.id, !cobranca.avisarAtraso)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(result.success || 'Notificações atualizadas.')
          router.refresh()
        }
      } finally {
        setTogglingId(null)
      }
    },
    [togglingId, router, toast],
  )

  // Envia agora, manualmente, um e-mail de cobrança para este cliente
  const handleEnviarEmail = useCallback(
    async (cobranca: Cobranca) => {
      if (enviandoEmailId) return
      if (!cobranca.clienteEmail) {
        toast.error('Adicione o e-mail do cliente antes de enviar.')
        return
      }
      setEnviandoEmailId(cobranca.id)
      try {
        const result = await enviarEmailCobranca(cobranca.id)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(result.success || 'E-mail enviado!')
        }
      } finally {
        setEnviandoEmailId(null)
      }
    },
    [enviandoEmailId, toast],
  )

  // Abre o modal de edição da cobrança
  const handleAbrirEditar = useCallback((cobranca: Cobranca) => {
    setEditarCobrancaData(cobranca)
  }, [])

  const handleFecharEditar = useCallback(() => {
    if (loadingEditar) return
    setEditarCobrancaData(null)
  }, [loadingEditar])

  const handleSalvarEditar = useCallback(
    async (dados: { clienteNome: string; clienteEmail: string; veiculoId: string; veiculoResumo: string }) => {
      if (!editarCobrancaData) return
      setLoadingEditar(true)
      try {
        const result = await editarCobranca(editarCobrancaData.id, dados)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(result.success || 'Cobrança atualizada!')
          setEditarCobrancaData(null)
          router.refresh()
        }
      } finally {
        setLoadingEditar(false)
      }
    },
    [editarCobrancaData, router, toast],
  )

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    const cob = cobrancas.find((c) => c.id === deleteId)
    startTransition(async () => {
      const result = await deletarCobranca(deleteId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Cobrança de ${cob?.clienteNome ?? 'cliente'} removida.`)
        router.refresh()
      }
      setDeleteId(null)
    })
  }, [deleteId, cobrancas, router, toast])

  const cobrancaParaExcluir = deleteId ? cobrancas.find((c) => c.id === deleteId) : null

  // Preview de cálculo no form
  const previewParcela = useMemo(() => {
    const total = parseMoney(valorTotal) || 0
    const entrada = parseMoney(valorEntrada) || 0
    const n = Math.max(Number(numeroParcelas) || 1, 1)
    const saldo = Math.max(total - entrada, 0)
    return {
      total,
      entrada,
      saldo,
      n,
      valorParcela: saldo / n,
      temEntrada: entrada > 0,
    }
  }, [valorTotal, valorEntrada, numeroParcelas])

  const veiculoSelecionado = veiculos.find((v) => v.id === veiculoId)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-28 md:space-y-6 md:pb-0">
      {/* ─── Header ─── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="hidden md:block">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Cobranças' }]} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-950 md:mt-1 md:text-3xl">
            Gestão de Cobranças
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 md:mt-1 md:text-sm">
            Promissórias, quinzenais e aluguéis semanais — tudo em um só lugar.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {currentRole === 'admin' && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<IconBellRinging size={14} stroke={2} />}
              onClick={handleTestarLembretes}
              loading={testandoLembretes}
              loadingLabel="Verificando..."
              title="Roda agora a checagem de lembretes de vencimento — útil para testar em ambiente local, onde não há cron automático."
            >
              Testar lembretes
            </Button>
          )}
          {canEdit && (
            <Button
              variant="liberty"
              leftIcon={<IconPlus size={16} stroke={2.5} />}
              onClick={openModal}
            >
              Nova Cobrança
            </Button>
          )}
        </div>
      </header>

      {/* ─── KPIs principais ─── */}
      <section
        aria-label="Resumo financeiro"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          label="Total contratado"
          value={formatCurrency(totalGeral)}
          icon={IconStack2}
          tone="neutral"
          hint={`${cobrancas.length} cobranças`}
        />
        <KpiCard
          label="Total recebido"
          value={formatCurrency(totalRecebido)}
          icon={IconCircleCheck}
          tone="success"
          hint={`${todasParcelas.filter((p) => p.pago).length} parcelas pagas`}
          progress={percentualGeralRecebido}
        />
        <KpiCard
          label="A receber"
          value={formatCurrency(totalPendente)}
          icon={IconClock}
          tone="warning"
          hint={`${todasParcelas.filter((p) => !p.pago).length} parcelas pendentes`}
        />
        <KpiCard
          label="Em atraso"
          value={formatCurrency(totalAtrasado)}
          icon={IconCircleX}
          tone="danger"
          hint={`${cobrancasAtrasadas} cobrança${cobrancasAtrasadas === 1 ? '' : 's'} com atraso`}
        />
      </section>

      {/* ─── Próximos vencimentos ─── */}
      {proximosVencimentos.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs md:p-5">
          <header className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-liberty/10 text-liberty">
                <IconCalendarEvent size={16} stroke={2} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
                  Próximos vencimentos (7 dias)
                </p>
                <h3 className="text-sm font-bold text-neutral-950">A receber em breve</h3>
              </div>
            </div>
            <span className="rounded-full border border-liberty/30 bg-liberty/10 px-2 py-0.5 text-[10px] font-bold text-liberty-deep">
              {proximosVencimentos.length}
            </span>
          </header>
          <ul className="divide-y divide-neutral-100">
            {proximosVencimentos.map((p) => {
              const cob = cobrancas.find((c) => c.id === p.cobrancaId)
              return (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="inline-flex h-7 w-10 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-[10px] font-bold text-neutral-500">
                    {p.numeroParcela}/{cob?.numeroParcelas ?? '?'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {cob?.clienteNome ?? '—'}
                    </p>
                    <p className="truncate text-[11px] text-neutral-500">
                      Vence {formatDate(p.dataVencimento)}
                      {p.status === 'parcial' && (
                        <span className="ml-1 font-semibold text-sky-600">
                          · pago {formatCurrency(p.valorPago)} de {formatCurrency(p.valorParcela)}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-neutral-900">
                    {formatCurrency(p.valorRestante)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAbrirPagamento(p)}
                    disabled={isPending}
                    aria-label="Registrar pagamento"
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-2.5 text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                  >
                    <IconCheck size={14} stroke={2.5} />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ─── Filtros + Lista ─── */}
      <section className="space-y-3">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-950 md:text-lg">
              Cobranças{' '}
              <span className="text-neutral-400 font-normal">
                ({cobrancasFiltradas.length}/{cobrancas.length})
              </span>
            </h2>
            <p className="text-[11px] text-neutral-500">
              Clique em uma cobrança para ver as parcelas e marcar pagamentos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setFilterTipo('todos')
                setFilterStatus('todas')
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-50 transition-ui cursor-pointer"
              title="Limpar filtros"
              disabled={!filtrosAtivos}
            >
              <IconFilter size={12} stroke={2} />
              Limpar
            </button>
          </div>
        </header>

        {/* Filtros */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <IconSearch
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente ou veículo..."
              className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:bg-white focus:outline-none transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 cursor-pointer"
                aria-label="Limpar busca"
              >
                <IconX size={12} stroke={2} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-neutral-200 bg-white p-1">
            {(
              [
                { id: 'todas', label: 'Todas' },
                { id: 'em-dia', label: 'Em dia' },
                { id: 'atrasadas', label: 'Atrasadas' },
                { id: 'quites', label: 'Quites' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilterStatus(opt.id)}
                className={
                  'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ' +
                  (filterStatus === opt.id
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : 'text-neutral-600 hover:bg-neutral-100')
                }
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-neutral-200 bg-white p-1">
            {(
              [
                { id: 'todos', label: 'Todos' },
                { id: 'promissoria', label: 'Mensal' },
                { id: 'quinzenal', label: 'Quinzenal' },
                { id: 'aluguel', label: 'Semanal' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilterTipo(opt.id as 'todos' | TipoCobranca)}
                className={
                  'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ' +
                  (filterTipo === opt.id
                    ? 'bg-liberty text-white shadow-xs'
                    : 'text-neutral-600 hover:bg-neutral-100')
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards de cobranças */}
        {cobrancasFiltradas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <IconReceipt size={24} stroke={1.5} className="text-neutral-400" />
            </div>
            <p className="text-sm font-semibold text-neutral-700">
              {cobrancas.length === 0
                ? 'Nenhuma cobrança cadastrada'
                : 'Nenhuma cobrança com esses filtros'}
            </p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-neutral-500">
              {cobrancas.length === 0
                ? 'Clique em "Nova Cobrança" para criar a primeira.'
                : 'Tente ajustar a busca ou os filtros.'}
            </p>
            {cobrancas.length === 0 && canEdit && (
              <button
                type="button"
                onClick={openModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-liberty px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-liberty-deep transition-colors cursor-pointer"
              >
                <IconPlus size={14} stroke={2.5} />
                Nova Cobrança
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {cobrancasFiltradas.map((c) => (
              <CobrancaCard
                key={c.id}
                cobranca={c}
                canEdit={canEdit}
                isExpanded={expandedId === c.id}
                onToggleExpand={() => setExpandedId((curr) => (curr === c.id ? null : c.id))}
                onRequestDelete={() => setDeleteId(c.id)}
                onEditarLembrete={handleAbrirLembrete}
                onToggleSino={handleToggleSino}
                onEditar={handleAbrirEditar}
                onPagar={handleAbrirPagamento}
                onDesfazer={handleDesfazerParcela}
                onRemoverPagamento={handleRemoverPagamento}
                onEnviarEmail={handleEnviarEmail}
                onEditarValor={handleAbrirEditarValor}
                pendingId={null}
                isToggling={isPending}
                togglingId={togglingId}
                enviandoEmailId={enviandoEmailId}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ─── Extrato Mensal ─── */}
      {extratoMensal.length > 0 && (
        <section className="space-y-3">
          <header>
            <h2 className="text-base font-bold text-neutral-950 md:text-lg">
              Extrato por Mês
            </h2>
            <p className="text-[11px] text-neutral-500">
              Recebimentos agrupados por mês de vencimento.
            </p>
          </header>
          <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden divide-y divide-neutral-100">
            {extratoMensal.map(({ mes, parcelas, totalPago, totalPendente: pendMes, totalAtrasado: atrMes }) => {
              const isOpen = expandedMes === mes
              const totalMes = totalPago + pendMes
              const percRecebido = totalMes > 0 ? (totalPago / totalMes) * 100 : 0
              return (
                <div key={mes}>
                  <button
                    type="button"
                    onClick={() => setExpandedMes(isOpen ? null : mes)}
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-neutral-50 cursor-pointer md:px-6 md:py-4"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold capitalize text-neutral-900 md:text-base">
                          {mesLabel(mes)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-500">
                          {parcelas.length} parcela{parcelas.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 md:gap-5">
                        <div className="text-right">
                          <p className="hidden text-[10px] font-bold uppercase tracking-wider text-neutral-400 md:block">
                            Recebido
                          </p>
                          <p className="text-sm font-bold text-emerald-700 md:text-base">
                            {formatCurrency(totalPago)}
                          </p>
                        </div>
                        {pendMes > 0 && (
                          <div className="text-right">
                            <p className="hidden text-[10px] font-bold uppercase tracking-wider text-neutral-400 md:block">
                              Pendente
                            </p>
                            <p className="text-sm font-bold text-amber-600 md:text-base">
                              {formatCurrency(pendMes)}
                            </p>
                          </div>
                        )}
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100 text-neutral-500 transition-transform md:h-8 md:w-8">
                          <IconChevronDown
                            size={14}
                            stroke={2.5}
                            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>
                    </div>
                    {/* Mini-progresso */}
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.min(percRecebido, 100)}%` }}
                      />
                    </div>
                    {atrMes > 0 && (
                      <p className="mt-1.5 text-[11px] font-semibold text-rose-600">
                        {formatCurrency(atrMes)} em atraso neste mês
                      </p>
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t border-neutral-100 bg-neutral-50/40">
                      <ExtratoMesDetalhes
                        mes={mes}
                        parcelas={parcelas}
                        cobrancas={cobrancas}
                        onPagar={handleAbrirPagamento}
                        isPending={isPending}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ─── Modal Nova Cobrança ─── */}
      {showModal && (
        <NovaCobrancaModal
          isOpen={showModal}
          onClose={closeModal}
          onSubmit={handleSubmit}
          loading={loadingForm}
          tipo={tipo}
          setTipo={setTipo}
          clienteNome={clienteNome}
          setClienteNome={setClienteNome}
          clienteEmail={clienteEmail}
          setClienteEmail={setClienteEmail}
          veiculoId={veiculoId}
          setVeiculoId={setVeiculoId}
          veiculoSelecionado={veiculoSelecionado}
          abrirVeiculoPicker={() => setShowVeiculoPicker(true)}
          valorTotal={valorTotal}
          setValorTotal={setValorTotal}
          valorEntrada={valorEntrada}
          setValorEntrada={setValorEntrada}
          numeroParcelas={numeroParcelas}
          setNumeroParcelas={setNumeroParcelas}
          diaVencimento={diaVencimento}
          setDiaVencimento={setDiaVencimento}
          primeiraParcela={primeiraParcela}
          setPrimeiraParcela={setPrimeiraParcela}
          preview={previewParcela}
          periodicidadeLabel={(t) => periodicidadeLabel(t)}
          labelParcelas={(t) => labelParcelas(t)}
          labelPrimeiraParcela={(t) => labelPrimeiraParcela(t)}
        />
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

      {/* Modal de registro de pagamento (total ou parcial) */}
      {pagamentoParcela && (
        <PagamentoModal
          parcela={pagamentoParcela}
          cliente={cobrancas.find((c) => c.id === pagamentoParcela.cobrancaId)?.clienteNome ?? null}
          loading={loadingPagamento}
          onClose={handleFecharPagamento}
          onSubmit={handleSubmitPagamento}
        />
      )}

      {/* Modal de edição do valor de uma parcela */}
      {editarValorParcelaData && (
        <EditarValorParcelaModal
          parcela={editarValorParcelaData}
          editorName={currentUserName}
          loading={loadingEditarValor}
          onClose={handleFecharEditarValor}
          onSubmit={handleSalvarEditarValor}
        />
      )}

      {/* Modal de configuração do lembrete de vencimento (e-mail) */}
      {lembreteCobranca && (
        <LembreteModal
          cobranca={lembreteCobranca}
          loading={loadingLembrete}
          onClose={handleFecharLembrete}
          onSubmit={handleSalvarLembrete}
        />
      )}

      {/* Modal de edição de cobrança (nome, e-mail, veículo) */}
      {editarCobrancaData && (
        <EditarCobrancaModal
          cobranca={editarCobrancaData}
          veiculos={veiculos}
          loading={loadingEditar}
          onClose={handleFecharEditar}
          onSubmit={handleSalvarEditar}
        />
      )}

      {/* Confirmação de exclusão — com nome do cliente */}
      {cobrancaParaExcluir && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/60 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeleteId(null)
            }}
          >
            <div className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl border border-neutral-200 overflow-hidden sm:rounded-2xl">
              <div className="flex items-start gap-3 border-b border-neutral-100 bg-rose-50/60 px-5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <IconAlertTriangle size={20} stroke={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-neutral-950">Remover Cobrança</h3>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>
              <div className="space-y-3 px-5 py-4">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-500">
                    Cobrança a remover
                  </p>
                  <p className="mt-1 text-sm font-bold text-neutral-900">
                    {cobrancaParaExcluir.clienteNome}
                  </p>
                  <p className="mt-0.5 text-[11px] text-neutral-500 truncate">
                    {cobrancaParaExcluir.veiculoResumo}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {badgeTipo(cobrancaParaExcluir.tipo)}
                    <span className="text-[11px] font-semibold text-neutral-700">
                      {cobrancaParaExcluir.numeroParcelas} × de{' '}
                      {formatCurrency(
                        cobrancaParaExcluir.valorTotal / Math.max(cobrancaParaExcluir.numeroParcelas, 1),
                      )}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-neutral-700">
                  Todas as <strong>{cobrancaParaExcluir.parcelas.length}</strong> parcelas
                  vinculadas serão excluídas permanentemente.
                </p>
              </div>
              <div className="flex flex-col gap-2 border-t border-neutral-100 bg-neutral-50/40 px-5 py-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  className="flex-1 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 transition-ui cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <svg className="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Removendo...
                    </>
                  ) : (
                    <>
                      <IconTrash size={14} stroke={2.5} />
                      Remover
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

// ─── KPI Card ──────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
  progress,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ size?: number; stroke?: number; className?: string }>
  tone: 'success' | 'warning' | 'danger' | 'neutral'
  hint?: string
  progress?: number
}) {
  const toneStyles: Record<typeof tone, string> = {
    success: 'border-emerald-200 bg-emerald-50/30',
    warning: 'border-amber-200 bg-amber-50/30',
    danger: 'border-rose-200 bg-rose-50/30',
    neutral: 'border-neutral-200 bg-white',
  }
  const valueColor: Record<typeof tone, string> = {
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-rose-700',
    neutral: 'text-neutral-950',
  }
  const iconBg: Record<typeof tone, string> = {
    success: 'bg-emerald-100 text-emerald-600',
    warning: 'bg-amber-100 text-amber-600',
    danger: 'bg-rose-100 text-rose-600',
    neutral: 'bg-neutral-100 text-neutral-600',
  }
  return (
    <div className={`rounded-2xl border p-4 shadow-xs md:p-5 ${toneStyles[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          {label}
        </span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg md:h-9 md:w-9 ${iconBg[tone]}`}>
          <Icon size={16} stroke={2} />
        </div>
      </div>
      <p className={`mt-2 text-lg font-black tabular-nums md:text-2xl ${valueColor[tone]}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-neutral-500">{hint}</p>}
      {typeof progress === 'number' && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-neutral-200/60">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-700"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Cobrança Card ─────────────────────────────────────────────────────────

function CobrancaCard({
  cobranca: c,
  canEdit,
  isExpanded,
  onToggleExpand,
  onRequestDelete,
  onEditarLembrete,
  onToggleSino,
  onEditar,
  onPagar,
  onDesfazer,
  onRemoverPagamento,
  onEnviarEmail,
  onEditarValor,
  isToggling,
  togglingId,
  enviandoEmailId,
}: {
  cobranca: Cobranca
  canEdit: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onRequestDelete: () => void
  onEditarLembrete: (cobranca: Cobranca) => void
  onToggleSino: (cobranca: Cobranca) => void
  onEditar: (cobranca: Cobranca) => void
  onPagar: (parcela: Parcela) => void
  onDesfazer: (parcelaId: string) => void
  onRemoverPagamento: (pagamentoId: string) => void
  onEnviarEmail: (cobranca: Cobranca) => void
  onEditarValor: (parcela: Parcela) => void
  pendingId: string | null
  isToggling: boolean
  togglingId: string | null
  enviandoEmailId: string | null
}) {
  const totalPago = useMemo(
    () => c.parcelas.reduce((a, p) => a + p.valorPago, 0),
    [c.parcelas],
  )
  const pagas = c.parcelas.filter((p) => p.pago).length
  const temAtraso = c.parcelas.some((p) => p.status === 'atrasado')
  const percentual = c.valorTotal > 0 ? (totalPago / c.valorTotal) * 100 : 0
  const proxVenc = c.parcelas
    .filter((p) => !p.pago && p.status !== 'atrasado')
    .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))[0]

  return (
    <li
      className={`rounded-2xl border bg-white shadow-xs overflow-hidden ${
        temAtraso ? 'border-rose-200' : 'border-neutral-200'
      }`}
    >
      {/* Cabeçalho */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-neutral-50 cursor-pointer md:p-5"
        aria-expanded={isExpanded}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 md:h-12 md:w-12">
          <IconUser size={18} stroke={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-neutral-900 md:text-base">
              {c.clienteNome}
            </span>
            {temAtraso && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                ATRASO
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
            {badgeTipo(c.tipo)}
            <span className="truncate">{c.veiculoResumo}</span>
          </div>
        </div>

        <div className="hidden text-right md:block">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Pago
          </p>
          <p className="text-sm font-bold text-emerald-700">
            {formatCurrency(totalPago)}
          </p>
          <p className="text-[10px] text-neutral-500">
            de {formatCurrency(c.valorTotal)}
          </p>
        </div>

        <div className="hidden text-right lg:block">
          {proxVenc ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Próx. venc.
              </p>
              <p className="text-xs font-bold text-neutral-900">
                {formatDate(proxVenc.dataVencimento)}
              </p>
            </>
          ) : (
            <p className="text-xs font-bold text-emerald-700">Em dia</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {canEdit && (() => {
            const temEmail = Boolean(c.clienteEmail)
            const isSendingEmail = enviandoEmailId === c.id

            return (
              <span
                role={temEmail ? 'button' : undefined}
                tabIndex={temEmail ? 0 : undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  if (temEmail && !isSendingEmail) onEnviarEmail(c)
                }}
                onKeyDown={(e) => {
                  if (!temEmail || isSendingEmail) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onEnviarEmail(c)
                  }
                }}
                aria-label={
                  !temEmail
                    ? 'Sem e-mail — edite a cobrança para adicionar'
                    : `Enviar e-mail de cobrança agora para ${c.clienteNome}`
                }
                title={
                  !temEmail
                    ? 'Adicione o e-mail no ✏️ editar para poder enviar'
                    : 'Enviar agora um e-mail de cobrança para este cliente'
                }
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  !temEmail
                    ? 'cursor-default text-neutral-300'
                    : isSendingEmail
                    ? 'cursor-wait text-neutral-400'
                    : 'cursor-pointer text-neutral-400 hover:bg-liberty/10 hover:text-liberty-deep'
                }`}
              >
                {isSendingEmail ? (
                  <IconLoader2 size={15} stroke={2} className="animate-spin" />
                ) : (
                  <IconSend size={15} stroke={2} />
                )}
              </span>
            )
          })()}

          {canEdit && (() => {
            const temEmail = Boolean(c.clienteEmail)
            const isThisToggling = togglingId === c.id
            const sinoAtivo = c.avisarAtraso

            return (
              <span
                role={temEmail ? 'button' : undefined}
                tabIndex={temEmail ? 0 : undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  if (temEmail && !isThisToggling) onToggleSino(c)
                }}
                onKeyDown={(e) => {
                  if (!temEmail || isThisToggling) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onToggleSino(c)
                  }
                }}
                aria-label={
                  !temEmail
                    ? 'Sem e-mail — edite a cobrança para adicionar'
                    : sinoAtivo
                    ? 'Desativar notificações por e-mail'
                    : 'Ativar notificações por e-mail'
                }
                title={
                  !temEmail
                    ? 'Adicione o e-mail no ✏️ editar para ativar notificações'
                    : sinoAtivo
                    ? 'Notificações ativas (3d antes, no dia, 1d após) — clique para desativar'
                    : 'Notificações desativadas — clique para ativar'
                }
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  !temEmail
                    ? 'cursor-default text-neutral-300'
                    : isThisToggling
                    ? 'cursor-wait text-neutral-400'
                    : sinoAtivo
                    ? 'cursor-pointer text-liberty-deep hover:bg-liberty/10'
                    : 'cursor-pointer text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
                }`}
              >
                {isThisToggling ? (
                  <IconLoader2 size={15} stroke={2} className="animate-spin" />
                ) : sinoAtivo ? (
                  <IconBellRinging size={15} stroke={2} />
                ) : (
                  <IconBellOff size={15} stroke={2} />
                )}
              </span>
            )
          })()}

          {canEdit && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onEditar(c)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onEditar(c)
                }
              }}
              aria-label="Editar cobrança"
              title="Editar nome, e-mail e veículo"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
            >
              <IconPencil size={14} stroke={2} />
            </span>
          )}
          {canEdit && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onRequestDelete()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onRequestDelete()
                }
              }}
              aria-label="Remover cobrança"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
            >
              <IconTrash size={15} stroke={2} />
            </span>
          )}
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 transition-transform md:h-9 md:w-9">
            <IconChevronDown
              size={16}
              stroke={2.5}
              className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </span>
        </div>
      </button>


      {/* Mobile resumo */}
      <div className="grid grid-cols-2 gap-3 border-t border-neutral-100 bg-neutral-50/40 px-4 py-3 md:hidden">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Pago
          </p>
          <p className="text-sm font-bold text-emerald-700">
            {formatCurrency(totalPago)}
          </p>
          <p className="text-[10px] text-neutral-500">
            de {formatCurrency(c.valorTotal)}
          </p>
        </div>
        <div className="text-right">
          {proxVenc ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Próx. venc.
              </p>
              <p className="text-sm font-bold text-neutral-900">
                {formatDate(proxVenc.dataVencimento)}
              </p>
            </>
          ) : (
            <p className="text-sm font-bold text-emerald-700">Em dia</p>
          )}
        </div>
      </div>

      {/* Progresso + entrada */}
      <div className="border-t border-neutral-100 px-4 py-3 md:px-5">
        {c.valorEntrada && c.valorEntrada > 0 && (
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center rounded-full border border-liberty/30 bg-liberty/10 px-2 py-0.5 font-bold uppercase tracking-wider text-liberty-deep">
              Entrada
            </span>
            <span className="font-bold text-neutral-900">
              {formatCurrency(c.valorEntrada)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-semibold text-neutral-600">
            {pagas}/{c.numeroParcelas} parcelas pagas
          </span>
          <span className="font-bold text-neutral-900">
            {Math.round(percentual)}%
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
            style={{ width: `${Math.min(percentual, 100)}%` }}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-neutral-100">
          <ParcelasList
            parcelas={c.parcelas}
            canEdit={canEdit}
            onPagar={onPagar}
            onDesfazer={onDesfazer}
            onRemoverPagamento={onRemoverPagamento}
            onEditarValor={onEditarValor}
            isToggling={isToggling}
          />
        </div>
      )}
    </li>
  )
}

// ─── Lista de Parcelas ─────────────────────────────────────────────────────

function PagamentosMini({
  pagamentos,
  canEdit,
  onRemover,
}: {
  pagamentos: Pagamento[]
  canEdit: boolean
  onRemover: (pagamentoId: string) => void
}) {
  if (pagamentos.length === 0) return null
  return (
    <ul className="mt-1.5 space-y-1">
      {pagamentos.map((pg) => (
        <li
          key={pg.id}
          className="flex items-center gap-1.5 text-[10px] text-neutral-500"
        >
          <IconCoin size={10} className="shrink-0 text-sky-500" />
          <span>
            {formatCurrency(pg.valor)} em {formatDate(pg.data)}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => onRemover(pg.id)}
              aria-label="Remover este pagamento"
              title="Remover este pagamento"
              className="ml-0.5 rounded p-0.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
            >
              <IconX size={10} stroke={2.5} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function ParcelaValorEditadoBadge({ parcela }: { parcela: Parcela }) {
  if (!parcela.valorEditadoPor) return null
  const detalhes = [
    `Editado por ${parcela.valorEditadoPor}`,
    parcela.valorOriginal != null ? `Valor original: ${formatCurrency(parcela.valorOriginal)}` : null,
    parcela.valorEditadoMotivo ? `Motivo: ${parcela.valorEditadoMotivo}` : null,
    parcela.valorEditadoEm ? `Em ${formatDate(parcela.valorEditadoEm.slice(0, 10))}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <span
      title={detalhes}
      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700"
    >
      <IconHistory size={9} stroke={2.5} />
      Editado
    </span>
  )
}

function ParcelasList({
  parcelas,
  canEdit,
  onPagar,
  onDesfazer,
  onRemoverPagamento,
  onEditarValor,
  isToggling,
}: {
  parcelas: Parcela[]
  canEdit: boolean
  onPagar: (parcela: Parcela) => void
  onDesfazer: (parcelaId: string) => void
  onRemoverPagamento: (pagamentoId: string) => void
  onEditarValor: (parcela: Parcela) => void
  isToggling: boolean
}) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  return (
    <div className="divide-y divide-neutral-100">
      {/* Mobile: cards por parcela */}
      <div className="md:hidden">
        {parcelas.map((p) => {
          const venc = new Date(p.dataVencimento + 'T00:00:00')
          const dias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                p.pago
                  ? 'bg-emerald-50/30'
                  : p.status === 'atrasado'
                    ? 'bg-rose-50/30'
                    : p.status === 'parcial'
                      ? 'bg-sky-50/30'
                      : ''
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-[11px] font-bold text-neutral-700">
                {p.numeroParcela}ª
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-bold text-neutral-900">
                    {formatCurrency(p.valorParcela)}
                  </p>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onEditarValor(p)}
                      aria-label="Editar valor da parcela"
                      title="Editar valor da parcela"
                      className="rounded p-0.5 text-liberty hover:bg-liberty/10 hover:text-liberty-deep cursor-pointer"
                    >
                      <IconEdit size={12} stroke={2} />
                    </button>
                  )}
                  <StatusBadge status={p.status} />
                  <ParcelaValorEditadoBadge parcela={p} />
                </div>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  Vence {formatDate(p.dataVencimento)}
                  {!p.pago && p.status !== 'atrasado' && dias >= 0 && (
                    <span className="ml-1 font-semibold text-amber-600">
                      · em {dias} dia{dias === 1 ? '' : 's'}
                    </span>
                  )}
                  {!p.pago && p.status === 'atrasado' && (
                    <span className="ml-1 font-semibold text-rose-600">
                      · {Math.abs(dias)} dia{Math.abs(dias) === 1 ? '' : 's'} atrasado
                    </span>
                  )}
                  {!p.pago && p.valorPago > 0 && (
                    <span className="ml-1 font-semibold text-sky-600">
                      · falta {formatCurrency(p.valorRestante)}
                    </span>
                  )}
                </p>
                <PagamentosMini
                  pagamentos={p.pagamentos}
                  canEdit={canEdit}
                  onRemover={onRemoverPagamento}
                />
              </div>
              {canEdit && (
                <button
                  type="button"
                  disabled={isToggling}
                  onClick={() => (p.pago ? onDesfazer(p.id) : onPagar(p))}
                  aria-label={p.pago ? 'Desfazer pagamento' : 'Registrar pagamento'}
                  title={p.pago ? 'Desfazer pagamento' : 'Registrar pagamento'}
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${
                    p.pago
                      ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {p.pago ? <IconX size={14} stroke={2.5} /> : <IconCheck size={14} stroke={2.5} />}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block">
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
              {parcelas.map((p) => (
                <tr
                  key={p.id}
                  className={`transition-colors ${
                    p.pago
                      ? 'bg-emerald-50/30'
                      : p.status === 'atrasado'
                        ? 'bg-rose-50/30'
                        : p.status === 'parcial'
                          ? 'bg-sky-50/30'
                          : ''
                  }`}
                >
                  <td className="px-5 py-3 font-bold text-neutral-700 align-top">
                    {p.numeroParcela}ª
                  </td>
                  <td className="px-5 py-3 text-neutral-600 align-top">
                    {formatDate(p.dataVencimento)}
                  </td>
                  <td className="px-5 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-bold text-neutral-900">
                        {formatCurrency(p.valorParcela)}
                      </p>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => onEditarValor(p)}
                          aria-label="Editar valor da parcela"
                          title="Editar valor da parcela"
                          className="rounded p-0.5 text-liberty hover:bg-liberty/10 hover:text-liberty-deep cursor-pointer"
                        >
                          <IconEdit size={12} stroke={2} />
                        </button>
                      )}
                      <ParcelaValorEditadoBadge parcela={p} />
                    </div>
                    {!p.pago && p.valorPago > 0 && (
                      <p className="mt-0.5 text-[11px] font-semibold text-sky-600">
                        pago {formatCurrency(p.valorPago)} · falta {formatCurrency(p.valorRestante)}
                      </p>
                    )}
                    <PagamentosMini
                      pagamentos={p.pagamentos}
                      canEdit={canEdit}
                      onRemover={onRemoverPagamento}
                    />
                  </td>
                  <td className="px-5 py-3 align-top">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-5 py-3 text-center align-top">
                    {canEdit && (
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => (p.pago ? onDesfazer(p.id) : onPagar(p))}
                        title={p.pago ? 'Desfazer pagamento' : 'Registrar pagamento'}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 cursor-pointer ${
                          p.pago
                            ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {p.pago ? (
                          <>
                            <IconX size={11} stroke={2.5} /> Desfazer
                          </>
                        ) : (
                          <>
                            <IconCheck size={11} stroke={2.5} /> {p.valorPago > 0 ? 'Pagar resto' : 'Pagar'}
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Detalhes do extrato mensal ────────────────────────────────────────────

function ExtratoMesDetalhes({
  mes: _mes,
  parcelas,
  cobrancas,
  onPagar,
  isPending,
}: {
  mes: string
  parcelas: Parcela[]
  cobrancas: Cobranca[]
  onPagar: (parcela: Parcela) => void
  isPending: boolean
}) {
  void _mes
  return (
    <div className="p-3 md:p-4">
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-neutral-200 bg-white p-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Recebido
          </p>
          <p className="text-base font-bold text-emerald-700">
            {formatCurrency(parcelas.reduce((a, p) => a + p.valorPago, 0))}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Pendente
          </p>
          <p className="text-base font-bold text-amber-600">
            {formatCurrency(
              parcelas
                .filter((p) => !p.pago && p.status !== 'atrasado')
                .reduce((a, p) => a + p.valorRestante, 0),
            )}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Atrasado
          </p>
          <p className="text-base font-bold text-rose-600">
            {formatCurrency(
              parcelas.filter((p) => p.status === 'atrasado').reduce((a, p) => a + p.valorRestante, 0),
            )}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {parcelas
          .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
          .map((p) => {
            const cob = cobrancas.find((c) => c.id === p.cobrancaId)
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-xl border p-2 ${
                  p.pago
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : p.status === 'atrasado'
                      ? 'border-rose-200 bg-rose-50/40'
                      : 'border-neutral-200 bg-white'
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/60 text-[10px] font-bold text-neutral-700">
                  {p.numeroParcela}ª
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-neutral-900">
                    {cob?.clienteNome ?? '—'}
                  </p>
                  <p className="truncate text-[10px] text-neutral-500">
                    {formatDate(p.dataVencimento)} · {formatCurrency(p.valorParcela)}
                    {!p.pago && p.valorPago > 0 && (
                      <span className="ml-1 font-semibold text-sky-600">
                        · falta {formatCurrency(p.valorRestante)}
                      </span>
                    )}
                  </p>
                </div>
                <StatusBadge status={p.status} />
                {!p.pago && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onPagar(p)}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                    aria-label="Registrar pagamento"
                  >
                    <IconCheck size={12} stroke={2.5} />
                  </button>
                )}
              </li>
            )
          })}
      </ul>
    </div>
  )
}

// ─── Modal Nova Cobrança ───────────────────────────────────────────────────

interface NovaCobrancaModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  loading: boolean
  tipo: TipoCobranca
  setTipo: (t: TipoCobranca) => void
  clienteNome: string
  setClienteNome: (s: string) => void
  clienteEmail: string
  setClienteEmail: (s: string) => void
  veiculoId: string
  setVeiculoId: (s: string) => void
  veiculoSelecionado: Veiculo | undefined
  abrirVeiculoPicker: () => void
  valorTotal: string
  setValorTotal: (s: string) => void
  valorEntrada: string
  setValorEntrada: (s: string) => void
  numeroParcelas: string
  setNumeroParcelas: (s: string) => void
  diaVencimento: string
  setDiaVencimento: (s: string) => void
  primeiraParcela: string
  setPrimeiraParcela: (s: string) => void
  preview: { total: number; entrada: number; saldo: number; n: number; valorParcela: number; temEntrada: boolean }
  periodicidadeLabel: (t: TipoCobranca) => string
  labelParcelas: (t: TipoCobranca) => string
  labelPrimeiraParcela: (t: TipoCobranca) => string
}

function NovaCobrancaModal({
  onClose,
  onSubmit,
  loading,
  tipo,
  setTipo,
  clienteNome,
  setClienteNome,
  clienteEmail,
  setClienteEmail,
  veiculoId,
  veiculoSelecionado,
  abrirVeiculoPicker,
  valorTotal,
  setValorTotal,
  valorEntrada,
  setValorEntrada,
  numeroParcelas,
  setNumeroParcelas,
  diaVencimento,
  setDiaVencimento,
  primeiraParcela,
  setPrimeiraParcela,
  preview,
  periodicidadeLabel,
  labelParcelas,
  labelPrimeiraParcela,
}: NovaCobrancaModalProps) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/60 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onSubmit={onSubmit}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-neutral-200 bg-white shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: 'calc(100vh - 1rem)' }}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 bg-gradient-to-br from-liberty/10 via-white to-white px-5 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-liberty text-white shadow-sm">
              <IconReceipt size={22} stroke={2} />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-950 sm:text-lg">
                Nova Cobrança
              </h2>
              <p className="mt-1 text-xs text-neutral-600">
                Escolha o tipo, vincule ao cliente/veículo e defina as parcelas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-ui cursor-pointer"
          >
            <IconX size={18} stroke={2} />
          </button>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:px-6 sm:py-6">
          {/* ── Tipo ── */}
          <section>
            <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
              <IconStack2 size={11} /> Tipo de Cobrança
            </p>
            <TipoPillSelect value={tipo} onChange={setTipo} />
          </section>

          {/* ── Cliente ── */}
          <section className="space-y-3">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
              <IconUser size={11} /> Cliente e Veículo
            </p>

            <Input
              id="clienteNome"
              label="Nome do Cliente *"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              placeholder="Nome completo"
              autoComplete="off"
              leftIcon={<IconUser size={14} />}
              required
            />

            <Input
              id="clienteEmail"
              label="E-mail do Cliente"
              type="email"
              value={clienteEmail}
              onChange={(e) => setClienteEmail(e.target.value)}
              placeholder="cliente@email.com"
              autoComplete="off"
              inputMode="email"
              leftIcon={<IconMail size={14} />}
              hint="Necessário para enviar o lembrete de vencimento por e-mail."
            />

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
                  Veículo *
                </label>
                {veiculoId && (
                  <button
                    type="button"
                    onClick={abrirVeiculoPicker}
                    className="text-[11px] font-bold uppercase tracking-wider text-liberty-deep hover:text-liberty transition-colors cursor-pointer"
                  >
                    Trocar
                  </button>
                )}
              </div>
              {veiculoSelecionado ? (
                <div className="flex items-center gap-3 rounded-xl border border-liberty/30 bg-liberty/5 p-2.5">
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                    {(() => {
                      const foto = Array.isArray(veiculoSelecionado.fotos) && veiculoSelecionado.fotos.length > 0
                        ? veiculoSelecionado.fotos[0]
                        : null
                      if (foto) {
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={foto}
                            alt={`${veiculoSelecionado.marca} ${veiculoSelecionado.modelo}`}
                            className="h-full w-full object-cover"
                          />
                        )
                      }
                      return (
                        <div className="flex h-full w-full items-center justify-center text-neutral-400">
                          <IconCar size={20} stroke={1.5} />
                        </div>
                      )
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-neutral-900">
                      {veiculoSelecionado.marca} {veiculoSelecionado.modelo}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-neutral-500">
                      {veiculoSelecionado.ano}
                      {veiculoSelecionado.placa ? ` • ${veiculoSelecionado.placa}` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={abrirVeiculoPicker}
                  className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50/40 px-4 py-3.5 text-left transition-colors hover:border-liberty/40 hover:bg-liberty/5 cursor-pointer"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-400 border border-neutral-200">
                    <IconCar size={20} stroke={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-neutral-700">Escolher veículo</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Toque para selecionar do estoque.
                    </p>
                  </div>
                  <IconChevronRight size={16} className="text-neutral-400" />
                </button>
              )}
            </div>
          </section>

          {/* ── Valores ── */}
          <section className="space-y-3">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
              <IconCoin size={11} /> Valores
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Input
                  id="valorTotal"
                  label="Valor Total *"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(maskMoney(e.target.value))}
                  placeholder="R$ 0,00"
                  inputMode="numeric"
                  leftIcon={<IconCurrencyDollar size={14} />}
                  required
                />
                <MoneyHint value={valorTotal} />
              </div>
              <div>
                <Input
                  id="valorEntrada"
                  label="Entrada (opcional)"
                  value={valorEntrada}
                  onChange={(e) => setValorEntrada(maskMoney(e.target.value))}
                  placeholder="R$ 0,00"
                  inputMode="numeric"
                  leftIcon={<IconCurrencyDollar size={14} />}
                />
                <MoneyHint value={valorEntrada} />
              </div>
            </div>

            <Input
              id="numeroParcelas"
              label={labelParcelas(tipo)}
              type="number"
              min="1"
              max="300"
              value={numeroParcelas}
              onChange={(e) => setNumeroParcelas(e.target.value)}
              leftIcon={<IconHash size={14} />}
              hint="Aceita até 300 parcelas (semanais, quinzenais ou mensais)."
              required
            />
          </section>

          {/* ── Datas ── */}
          <section className="space-y-3">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
              <IconCalendarEvent size={11} /> Datas
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {tipo === 'promissoria' && (
                <Input
                  id="diaVencimento"
                  label="Dia do Vencimento *"
                  type="number"
                  min="1"
                  max="31"
                  value={diaVencimento}
                  onChange={(e) => setDiaVencimento(e.target.value)}
                  leftIcon={<IconHash size={14} />}
                  hint="Para cobranças mensais."
                  required
                />
              )}
              <Input
                id="primeiraParcela"
                label={labelPrimeiraParcela(tipo)}
                type="date"
                value={primeiraParcela}
                onChange={(e) => setPrimeiraParcela(e.target.value)}
                leftIcon={<IconCalendar size={14} />}
                required
              />
            </div>
          </section>

          {/* ── Preview ── */}
          {preview.total > 0 && preview.n > 0 && (
            <section
              className="rounded-2xl border border-liberty/30 bg-gradient-to-br from-liberty/5 via-white to-white p-4"
              aria-label="Prévia do parcelamento"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-liberty/10 text-liberty">
                  <IconCalculator size={18} stroke={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-liberty-deep">
                    Prévia do parcelamento
                  </p>
                  <p className="mt-1 text-sm text-neutral-700">
                    {preview.n}× de{' '}
                    <strong className="text-emerald-700">
                      {formatCurrency(preview.valorParcela)}
                    </strong>{' '}
                    <span className="text-neutral-500">
                      {periodicidadeLabel(tipo)}
                    </span>
                  </p>
                  {preview.temEntrada && (
                    <p className="mt-0.5 text-[11px] text-neutral-600">
                      Entrada{' '}
                      <strong className="text-neutral-900">
                        {formatCurrency(preview.entrada)}
                      </strong>
                      {' · '}saldo{' '}
                      <strong className="text-neutral-900">
                        {formatCurrency(preview.saldo)}
                      </strong>
                    </p>
                  )}
                  <p className="mt-1 text-[11px] font-semibold text-neutral-500">
                    Total: {formatCurrency(preview.entrada + preview.valorParcela * preview.n)}
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Rodapé fixo */}
        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-liberty px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer hover:bg-liberty-deep disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg
                  className="h-3 w-3 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Salvando...
              </>
            ) : (
              <>
                <IconCheck size={14} stroke={2.5} />
                Cadastrar
              </>
            )}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

// ─── Modal Registrar Pagamento (total ou parcial) ─────────────────────────

function PagamentoModal({
  parcela,
  cliente,
  loading,
  onClose,
  onSubmit,
}: {
  parcela: Parcela
  cliente: string | null
  loading: boolean
  onClose: () => void
  onSubmit: (valor: number, data: string) => void
}) {
  const [valor, setValor] = useState(() => maskMoney(String(Math.round(parcela.valorRestante * 100))))
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (typeof document === 'undefined') return null

  const valorNum = parseMoney(valor)
  const restanteAposPagamento = Math.max(round2(parcela.valorRestante - valorNum), 0)
  const ehParcial = valorNum > 0 && valorNum < parcela.valorRestante - 0.01

  function round2(n: number) {
    return Math.round(n * 100) / 100
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    if (!valorNum || valorNum <= 0) {
      setErrorMsg('Informe um valor válido.')
      return
    }
    if (valorNum > parcela.valorRestante + 0.01) {
      setErrorMsg(`O valor não pode ser maior que o saldo restante (${formatCurrency(parcela.valorRestante)}).`)
      return
    }
    if (!data) {
      setErrorMsg('Informe a data do pagamento.')
      return
    }
    onSubmit(valorNum, data)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/60 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-2xl border border-neutral-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 bg-gradient-to-br from-emerald-50 via-white to-white px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <IconCoin size={20} stroke={2} />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-950">Registrar Pagamento</h2>
              <p className="mt-0.5 text-xs text-neutral-600">
                {cliente ?? 'Cliente'} · Parcela {parcela.numeroParcela}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-ui cursor-pointer disabled:opacity-50"
          >
            <IconX size={18} stroke={2} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500">Valor da parcela</span>
              <span className="font-bold text-neutral-900">{formatCurrency(parcela.valorParcela)}</span>
            </div>
            {parcela.valorPago > 0 && (
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-neutral-500">Já pago</span>
                <span className="font-bold text-emerald-700">{formatCurrency(parcela.valorPago)}</span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-neutral-500">Saldo restante</span>
              <span className="font-bold text-rose-600">{formatCurrency(parcela.valorRestante)}</span>
            </div>
          </div>

          <Input
            id="valorPagamento"
            label="Valor a pagar agora *"
            value={valor}
            onChange={(e) => setValor(maskMoney(e.target.value))}
            placeholder="R$ 0,00"
            inputMode="numeric"
            leftIcon={<IconCurrencyDollar size={14} />}
            required
            autoFocus
          />

          <Input
            id="dataPagamento"
            label="Data do pagamento *"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            leftIcon={<IconCalendar size={14} />}
            required
          />

          {ehParcial && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-semibold text-sky-700">
              Pagamento parcial — restarão {formatCurrency(restanteAposPagamento)} em aberto nesta parcela.
            </p>
          )}

          {errorMsg && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
              {errorMsg}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Salvando...
              </>
            ) : (
              <>
                <IconCheck size={14} stroke={2.5} />
                Confirmar Pagamento
              </>
            )}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

// ─── Modal Editar Valor da Parcela ────────────────────────────────────────

function EditarValorParcelaModal({
  parcela,
  editorName,
  loading,
  onClose,
  onSubmit,
}: {
  parcela: Parcela
  editorName: string
  loading: boolean
  onClose: () => void
  onSubmit: (novoValor: number, motivo: string) => void
}) {
  const [valor, setValor] = useState(() => maskMoney(String(Math.round(parcela.valorParcela * 100))))
  const [motivo, setMotivo] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (typeof document === 'undefined') return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    const valorNum = parseMoney(valor)
    if (!valorNum || valorNum <= 0) {
      setErrorMsg('Informe um valor válido.')
      return
    }
    if (parcela.valorPago > 0 && valorNum < parcela.valorPago - 0.01) {
      setErrorMsg(`O novo valor não pode ser menor que o já pago (${formatCurrency(parcela.valorPago)}).`)
      return
    }

    onSubmit(valorNum, motivo.trim())
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/60 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-2xl border border-neutral-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 bg-gradient-to-br from-liberty/10 via-white to-white px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-liberty text-white shadow-sm">
              <IconEdit size={20} stroke={2} />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-950">Editar Valor da Parcela</h2>
              <p className="mt-0.5 text-xs text-neutral-600">Parcela {parcela.numeroParcela}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-ui cursor-pointer disabled:opacity-50"
          >
            <IconX size={18} stroke={2} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500">Valor atual</span>
              <span className="font-bold text-neutral-900">{formatCurrency(parcela.valorParcela)}</span>
            </div>
            {parcela.valorPago > 0 && (
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-neutral-500">Já pago</span>
                <span className="font-bold text-emerald-700">{formatCurrency(parcela.valorPago)}</span>
              </div>
            )}
            {parcela.valorEditadoPor && (
              <div className="mt-2 border-t border-neutral-200 pt-2 text-[11px] text-neutral-500">
                Última edição por <strong className="text-neutral-700">{parcela.valorEditadoPor}</strong>
                {parcela.valorEditadoMotivo ? ` — ${parcela.valorEditadoMotivo}` : ''}
              </div>
            )}
          </div>

          <Input
            id="novoValorParcela"
            label="Novo valor da parcela *"
            value={valor}
            onChange={(e) => setValor(maskMoney(e.target.value))}
            placeholder="R$ 0,00"
            inputMode="numeric"
            leftIcon={<IconCurrencyDollar size={14} />}
            required
            autoFocus
          />

          <div className="flex items-center gap-2 rounded-lg border border-liberty/30 bg-liberty/10 px-3 py-2">
            <IconUser size={14} className="shrink-0 text-liberty-deep" />
            <p className="text-[11px] font-semibold text-liberty-deep">
              Editando como <span className="font-bold">{editorName}</span>
            </p>
          </div>

          <Input
            id="motivoEdicao"
            label="Motivo (opcional)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: Renegociação, desconto..."
            leftIcon={<IconPencil size={14} />}
          />

          <p className="rounded-lg border border-liberty/30 bg-liberty/10 px-3 py-2 text-[11px] font-semibold text-liberty-deep">
            A parcela ficará marcada como "Editada" e o histórico da alteração fica visível para a equipe.
          </p>

          {errorMsg && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
              {errorMsg}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-liberty px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer hover:bg-liberty-deep disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Salvando...
              </>
            ) : (
              <>
                <IconCheck size={14} stroke={2.5} />
                Salvar Valor
              </>
            )}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

// ─── Modal Lembrete de Vencimento ("cobrar quando faltar X dias") ─────────

function LembreteModal({
  cobranca,
  loading,
  onClose,
  onSubmit,
}: {
  cobranca: Cobranca
  loading: boolean
  onClose: () => void
  onSubmit: (email: string, dias: number | null, avisarAtraso: boolean) => void
}) {
  const [email, setEmail] = useState(cobranca.clienteEmail ?? '')
  const [dias, setDias] = useState(
    cobranca.diasAvisoAntecedencia ? String(cobranca.diasAvisoAntecedencia) : '',
  )
  const [avisarAtraso, setAvisarAtraso] = useState(cobranca.avisarAtraso)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (typeof document === 'undefined') return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    const emailLimpo = email.trim()
    const diasNum = dias.trim() ? parseInt(dias, 10) : null

    if ((diasNum || avisarAtraso) && !emailLimpo) {
      setErrorMsg('Informe o e-mail do cliente para poder enviar os avisos.')
      return
    }
    if (emailLimpo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      setErrorMsg('E-mail inválido.')
      return
    }

    onSubmit(emailLimpo, diasNum, avisarAtraso)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/60 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-2xl border border-neutral-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 bg-gradient-to-br from-liberty/10 via-white to-white px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-liberty text-white shadow-sm">
              <IconBellRinging size={20} stroke={2} />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-950">Lembrete de Vencimento</h2>
              <p className="mt-0.5 text-xs text-neutral-600">{cobranca.clienteNome}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-ui cursor-pointer disabled:opacity-50"
          >
            <IconX size={18} stroke={2} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="text-xs text-neutral-600 leading-relaxed">
            Quando faltar o número de dias abaixo para o vencimento de cada parcela em aberto,
            enviamos automaticamente um e-mail avisando o cliente.
          </p>

          <Input
            id="lembreteEmail"
            label="E-mail do Cliente"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.com"
            autoComplete="off"
            inputMode="email"
            leftIcon={<IconMail size={14} />}
            autoFocus
          />

          <Input
            id="lembreteDias"
            label="Cobrar quando faltar (dias)"
            type="number"
            min="1"
            max="60"
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            placeholder="Ex.: 3"
            leftIcon={<IconBell size={14} />}
            hint="Deixe em branco para desativar o lembrete desta cobrança."
          />

          <label
            className={
              'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors ' +
              (avisarAtraso
                ? 'border-rose-300 bg-rose-50/50'
                : 'border-neutral-200 bg-white hover:border-rose-200')
            }
          >
            <input
              type="checkbox"
              checked={avisarAtraso}
              onChange={(e) => setAvisarAtraso(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
            />
            <span className="min-w-0">
              <span className="block text-xs font-bold text-neutral-900">
                Também avisar quando atrasar
              </span>
              <span className="mt-0.5 block text-[11px] text-neutral-500">
                Envia um e-mail de cobrança assim que uma parcela vencer sem pagamento (uma vez por parcela).
              </span>
            </span>
          </label>

          {errorMsg && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
              {errorMsg}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-liberty px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer hover:bg-liberty-deep disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Salvando...
              </>
            ) : (
              <>
                <IconCheck size={14} stroke={2.5} />
                Salvar Lembrete
              </>
            )}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

// ─── Modal de Edição de Cobrança ──────────────────────────────────────────────

function EditarCobrancaModal({
  cobranca,
  veiculos,
  loading,
  onClose,
  onSubmit,
}: {
  cobranca: Cobranca
  veiculos: Veiculo[]
  loading: boolean
  onClose: () => void
  onSubmit: (dados: { clienteNome: string; clienteEmail: string; veiculoId: string; veiculoResumo: string }) => void
}) {
  const [nome, setNome] = useState(cobranca.clienteNome)
  const [email, setEmail] = useState(cobranca.clienteEmail ?? '')
  const [veiculoId, setVeiculoId] = useState(cobranca.veiculoId)
  const [showPicker, setShowPicker] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const veiculoSelecionado = veiculos.find((v) => v.id === veiculoId)
  const veiculoResumoAtual = veiculoSelecionado
    ? `${veiculoSelecionado.marca} ${veiculoSelecionado.modelo} ${veiculoSelecionado.ano ?? ''}${veiculoSelecionado.placa ? ` • ${veiculoSelecionado.placa}` : ''}`.trim()
    : cobranca.veiculoResumo

  const emailFoiRemovido = !email.trim() && Boolean(cobranca.clienteEmail) && cobranca.avisarAtraso

  if (typeof document === 'undefined') return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    const nomeLimpo = nome.trim()
    const emailLimpo = email.trim()

    if (!nomeLimpo) {
      setErrorMsg('Informe o nome do cliente.')
      return
    }
    if (!veiculoId) {
      setErrorMsg('Selecione um veículo.')
      return
    }
    if (emailLimpo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      setErrorMsg('E-mail inválido.')
      return
    }

    onSubmit({
      clienteNome: nomeLimpo,
      clienteEmail: emailLimpo,
      veiculoId,
      veiculoResumo: veiculoResumoAtual,
    })
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/60 backdrop-blur-sm sm:items-center sm:p-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !loading) onClose()
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-t-2xl border border-neutral-200 bg-white shadow-2xl sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-neutral-100 bg-gradient-to-br from-neutral-50 via-white to-white px-5 pt-5 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-sm">
                <IconPencil size={20} stroke={2} />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-950">Editar Cobrança</h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {periodicidadeLabel(cobranca.tipo)} · {cobranca.numeroParcelas} parcela{cobranca.numeroParcelas === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              aria-label="Fechar"
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-ui cursor-pointer disabled:opacity-50"
            >
              <IconX size={18} stroke={2} />
            </button>
          </div>

          {/* Campos editáveis */}
          <div className="space-y-4 px-5 py-5">
            {/* Nome */}
            <div className="space-y-1">
              <label htmlFor="editNome" className="block text-xs font-bold text-neutral-700">
                Nome do Cliente *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  <IconUser size={14} />
                </span>
                <input
                  id="editNome"
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                  autoFocus
                  className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* E-mail */}
            <div className="space-y-1">
              <label htmlFor="editEmail" className="block text-xs font-bold text-neutral-700">
                E-mail do Cliente
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  <IconMail size={14} />
                </span>
                <input
                  id="editEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@email.com (opcional)"
                  inputMode="email"
                  autoComplete="off"
                  className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors"
                />
              </div>
              {emailFoiRemovido && (
                <p className="text-[11px] text-amber-600 flex items-center gap-1">
                  <IconAlertTriangle size={11} stroke={2} />
                  Ao remover o e-mail, as notificações serão desativadas automaticamente.
                </p>
              )}
              {!cobranca.clienteEmail && (
                <p className="text-[11px] text-neutral-500">
                  Adicione um e-mail para poder ativar o sino de notificações. 🔔
                </p>
              )}
            </div>

            {/* Veículo */}
            <div className="space-y-1">
              <span className="block text-xs font-bold text-neutral-700">Veículo *</span>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-neutral-400 hover:bg-neutral-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
                  <IconCar size={16} stroke={2} />
                </span>
                <span className="min-w-0 flex-1">
                  {veiculoSelecionado ? (
                    <>
                      <span className="block truncate text-sm font-semibold text-neutral-900">
                        {veiculoSelecionado.marca} {veiculoSelecionado.modelo}
                      </span>
                      <span className="block text-[11px] text-neutral-500">
                        {veiculoSelecionado.ano ?? ''}{veiculoSelecionado.placa ? ` · ${veiculoSelecionado.placa}` : ''}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-neutral-400">Selecionar veículo...</span>
                  )}
                </span>
                <IconChevronRight size={14} stroke={2} className="shrink-0 text-neutral-400" />
              </button>
            </div>

            {/* Campos imutáveis — informativo */}
            <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
              <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Imutável após criação</p>
              <div className="flex flex-wrap gap-3 text-xs text-neutral-600">
                <span className="flex items-center gap-1">
                  <IconHash size={11} stroke={2} className="text-neutral-400" />
                  {cobranca.numeroParcelas} parcela{cobranca.numeroParcelas === 1 ? '' : 's'}
                </span>
                <span className="flex items-center gap-1">
                  <IconCalendar size={11} stroke={2} className="text-neutral-400" />
                  {periodicidadeLabel(cobranca.tipo)}
                </span>
                <span className="flex items-center gap-1">
                  <IconCoin size={11} stroke={2} className="text-neutral-400" />
                  {formatCurrency(cobranca.valorTotal)}
                </span>
              </div>
            </div>

            {errorMsg && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
                {errorMsg}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/60 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer hover:bg-neutral-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <IconLoader2 size={13} stroke={2} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <IconCheck size={14} stroke={2.5} />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* VeiculoPicker dentro do modal */}
      <VeiculoPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
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
    </>,
    document.body,
  )
}
