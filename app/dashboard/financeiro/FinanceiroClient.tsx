'use client'

import {
  startTransition,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  IconReceipt,
  IconWallet,
  IconArrowUpRight,
  IconArrowDownRight,
  IconPlus,
  IconPencil,
  IconTrash,
  IconTrendingUp,
  IconChevronLeft,
  IconChevronRight,
  IconCalendarMonth,
  IconPaperclip,
  IconCircleCheck,
} from '@tabler/icons-react'
import {
  Breadcrumb,
  EmptyState,
  ConfirmDialog,
  Input,
  Select,
  useToast,
} from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'
import {
  maskMoneyIntuitivo,
  parseMoneyIntuitivo,
  moneyFromNumber,
} from './money'
import { createTransacao, updateTransacao, deleteTransacao } from './actions'
import ComprovanteTransacao from './ComprovanteTransacao'
import {
  deslocarMes,
  hojeNoFuso,
  listarMeses,
  mesAtual,
  rotuloMes,
  rotuloMesCurto,
  type Mes,
} from './periodo'
import {
  TRANSACAO_CATEGORIAS,
  type Transacao,
  type TransacaoCategoria,
  type TransacaoComprovante,
  type TransacaoResponse,
  type TransacaoStatus,
  type TransacaoTipo,
} from './types'

export default function FinanceiroClient({
  initialTransacoes,
  mes,
  mesFixadoNaUrl,
  primeiroMes,
  ultimoMes,
}: {
  initialTransacoes: Transacao[]
  /** Mês exibido (`YYYY-MM`). */
  mes: Mes
  /** `true` quando o mês veio de `?mes=` — desliga a virada automática. */
  mesFixadoNaUrl: boolean
  primeiroMes: string | null
  ultimoMes: string | null
}) {
  const router = useRouter()
  const toast = useToast()
  const [filterTipo, setFilterTipo] = useState<'todos' | 'receita' | 'despesa'>('todos')
  const [submitting, setSubmitting] = useState(false)
  const [navegando, iniciarNavegacao] = useTransition()

  // A lista renderiza direto das props do servidor; o `useOptimistic` só
  // sobrepõe a remoção enquanto a action está em voo e se desfaz sozinho quando
  // os dados novos chegam. Guardar as transações em `useState` deixaria a tela
  // presa nos dados do primeiro render — o que, com troca de mês, mostraria os
  // lançamentos do mês anterior.
  const [transacoes, removerOtimista] = useOptimistic(
    initialTransacoes,
    (atual: Transacao[], idRemovido: string) => atual.filter((t) => t.id !== idRemovido),
  )

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Transacao | null>(null)

  // Form fields
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<TransacaoCategoria>('Venda de Veículo')
  const [categoriaOutrosNome, setCategoriaOutrosNome] = useState('')
  const [tipo, setTipo] = useState<TransacaoTipo>('receita')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(() => hojeNoFuso())
  const [status, setStatus] = useState<TransacaoStatus>('concluido')

  // Confirmação de exclusão
  const [confirmDelete, setConfirmDelete] = useState<Transacao | null>(null)
  const [removerPagamentoVinculado, setRemoverPagamentoVinculado] = useState(false)

  // Comprovante (nota fiscal / recibo em PDF ou imagem) do lançamento.
  const [comprovanteDe, setComprovanteDe] = useState<Transacao | null>(null)
  // Sobrepõe o `comprovante` vindo do servidor assim que anexar/remover é
  // confirmado, para a linha da tabela mudar na hora — sem esperar um
  // `router.refresh()` reidratar as props do servidor.
  const [comprovanteOverrides, setComprovanteOverrides] = useState<
    Record<string, TransacaoComprovante | null>
  >({})

  function getComprovante(t: Transacao): TransacaoComprovante | null {
    return t.id in comprovanteOverrides ? comprovanteOverrides[t.id] : (t.comprovante ?? null)
  }

  const totalReceitas = useMemo(
    () =>
      transacoes
        .filter((t) => t.tipo === 'receita' && t.status === 'concluido')
        .reduce((acc, t) => acc + t.valor, 0),
    [transacoes],
  )

  const totalDespesas = useMemo(
    () =>
      transacoes
        .filter((t) => t.tipo === 'despesa' && t.status === 'concluido')
        .reduce((acc, t) => acc + t.valor, 0),
    [transacoes],
  )

  const saldoTotal = totalReceitas - totalDespesas

  // ─── Período ──────────────────────────────────────────────────────────────

  const mesCorrente = mesAtual()
  const ehMesCorrente = mes === mesCorrente

  /** Meses navegáveis: do lançamento mais antigo até o mês corrente — ou até o
   *  lançamento mais futuro, se houver pendente com data à frente. */
  const mesesDisponiveis = useMemo(() => {
    const inicio = primeiroMes ?? mesCorrente
    const fim = [ultimoMes ?? mesCorrente, mesCorrente, mes].sort().at(-1)!
    return listarMeses(inicio > mes ? mes : inicio, fim)
  }, [primeiroMes, ultimoMes, mesCorrente, mes])

  const temMesAnterior = mesesDisponiveis.includes(deslocarMes(mes, -1))
  const temMesSeguinte = mesesDisponiveis.includes(deslocarMes(mes, 1))

  function irParaMes(destino: Mes) {
    iniciarNavegacao(() => {
      // Sem query quando é o mês corrente: assim a página volta a seguir o
      // relógio e a virada automática do dia 1 volta a valer.
      router.push(
        destino === mesCorrente
          ? '/dashboard/financeiro'
          : `/dashboard/financeiro?mes=${destino}`,
      )
    })
  }

  /**
   * Virada automática do mês.
   *
   * Enquanto o painel estiver seguindo o mês corrente (sem `?mes=` na URL), à
   * meia-noite do dia 1 o mês de referência muda e a tela precisa se atualizar
   * sozinha — inclusive num painel deixado aberto a noite toda.
   *
   * É uma verificação periódica, e não um `setTimeout` calculado até a virada,
   * porque o timer exato erraria em toda aba em segundo plano (o navegador
   * estrangula timers) e em máquina que dormiu. Por isso também reconferimos
   * quando a aba volta ao foco: é o caso comum de um computador que passou a
   * madrugada suspenso.
   */
  useEffect(() => {
    if (mesFixadoNaUrl) return

    // Trava contra relógio adiantado: se a máquina do usuário achar que já
    // virou o mês mas o servidor discordar, o refresh traria o mesmo mês de
    // volta e a checagem dispararia de novo a cada 30s, em laço. Pedimos o
    // refresh no máximo uma vez por mês-alvo; quando o servidor de fato virar,
    // `mes` muda, o efeito remonta e a trava zera.
    let jaPedidoPara: string | null = null

    function conferirVirada() {
      const agora = mesAtual()
      if (agora === mes || jaPedidoPara === agora) return
      jaPedidoPara = agora
      router.refresh()
    }

    const intervalo = window.setInterval(conferirVirada, 30_000)
    window.addEventListener('focus', conferirVirada)
    document.addEventListener('visibilitychange', conferirVirada)

    return () => {
      window.clearInterval(intervalo)
      window.removeEventListener('focus', conferirVirada)
      document.removeEventListener('visibilitychange', conferirVirada)
    }
  }, [mes, mesFixadoNaUrl, router])

  const filteredTransacoes = useMemo(
    () =>
      transacoes.filter((t) => {
        if (filterTipo === 'todos') return true
        return t.tipo === filterTipo
      }),
    [transacoes, filterTipo],
  )

  /**
   * Data que o formulário sugere. No mês corrente é hoje; num mês anterior é o
   * dia 1 daquele mês — senão o lançamento nasceria fora do período aberto na
   * tela e sumiria assim que fosse salvo.
   */
  function dataSugerida() {
    return ehMesCorrente ? hojeNoFuso() : `${mes}-01`
  }

  function resetForm() {
    setDescricao('')
    setValor('')
    setCategoria('Venda de Veículo')
    setCategoriaOutrosNome('')
    setTipo('receita')
    setData(dataSugerida())
    setStatus('concluido')
  }

  function openCreate() {
    setEditing(null)
    resetForm()
    setShowModal(true)
  }

  function openEdit(t: Transacao) {
    setEditing(t)
    setDescricao(t.descricao)
    // Categorias que não estão na lista predefinida foram salvas como um
    // nome customizado de "Outros" — reabre o formulário nesse estado.
    if (TRANSACAO_CATEGORIAS.includes(t.categoria as TransacaoCategoria)) {
      setCategoria(t.categoria as TransacaoCategoria)
      setCategoriaOutrosNome('')
    } else {
      setCategoria('Outros')
      setCategoriaOutrosNome(t.categoria)
    }
    setTipo(t.tipo)
    setValor(moneyFromNumber(t.valor))
    setData(t.data || hojeNoFuso())
    setStatus(t.status)
    setShowModal(true)
  }

  function closeForm() {
    setShowModal(false)
    setEditing(null)
    resetForm()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)

    const categoriaFinal =
      categoria === 'Outros' && categoriaOutrosNome.trim()
        ? categoriaOutrosNome.trim()
        : categoria

    const fd = new FormData()
    fd.append('descricao', descricao.trim())
    fd.append('categoria', categoriaFinal)
    fd.append('tipo', tipo)
    fd.append('valor', String(parseMoneyIntuitivo(valor)))
    fd.append('data', data)
    fd.append('status', status)

    try {
      const result: TransacaoResponse = editing
        ? await updateTransacao(editing.id, fd)
        : await createTransacao(fd)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(result.success || (editing ? 'Lançamento atualizado.' : 'Lançamento registrado.'))
      closeForm()
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message || 'Erro inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleDelete(t: Transacao) {
    if (submitting) return
    setSubmitting(true)
    const target = t
    const removerVinculo = removerPagamentoVinculado
    setConfirmDelete(null)
    setRemoverPagamentoVinculado(false)

    // A remoção otimista tem que acontecer DENTRO da transition: fora dela o
    // React descarta o estado otimista no mesmo instante. Ela se desfaz sozinha
    // quando o `router.refresh()` traz a lista já sem o registro — ou quando a
    // action falha, aí a linha reaparece, que é o comportamento correto.
    startTransition(async () => {
      removerOtimista(target.id)
      try {
        const result = await deleteTransacao(target.id, removerVinculo)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(result.success || 'Lançamento removido.')
        }
      } catch (err: any) {
        toast.error(err?.message || 'Erro ao remover.')
      } finally {
        router.refresh()
        setSubmitting(false)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Financeiro' }]} />
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950 adobe-dark:text-adobe-text-hi">
            Gestão Financeira
          </h1>
          <p className="mt-1 text-sm text-neutral-500 adobe-dark:text-adobe-text-lo">
            Controle de entradas, saídas, faturamento e balanço das operações da Liberty Car.
          </p>
        </div>

        <button
          onClick={openCreate}
          disabled={navegando}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-neutral-800 transition-colors cursor-pointer self-start sm:self-auto adobe-dark:bg-adobe-accent adobe-dark:text-[#0a1720] adobe-dark:hover:bg-adobe-accent-deep"
        >
          <IconPlus size={16} stroke={2.5} />
          Novo Lançamento
        </button>
      </div>

      {/* Seletor de período — tudo abaixo daqui é escopado neste mês. */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => irParaMes(deslocarMes(mes, -1))}
            disabled={!temMesAnterior || navegando}
            aria-label="Mês anterior"
            title={temMesAnterior ? 'Mês anterior' : 'Não há lançamentos antes deste mês'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-3"
          >
            <IconChevronLeft size={18} stroke={2} />
          </button>
          <button
            type="button"
            onClick={() => irParaMes(deslocarMes(mes, 1))}
            disabled={!temMesSeguinte || navegando}
            aria-label="Próximo mês"
            title={temMesSeguinte ? 'Próximo mês' : 'Este já é o mês mais recente'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-3"
          >
            <IconChevronRight size={18} stroke={2} />
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <IconCalendarMonth
            size={18}
            stroke={2}
            className="shrink-0 text-neutral-400 adobe-dark:text-adobe-text-lo"
          />
          <label className="sr-only" htmlFor="seletor-mes">
            Mês de referência
          </label>
          <select
            id="seletor-mes"
            value={mes}
            disabled={navegando}
            onChange={(e) => irParaMes(e.target.value)}
            className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-bold text-neutral-900 transition-colors hover:bg-neutral-50 disabled:opacity-50 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-hi adobe-dark:hover:bg-adobe-bg-3"
          >
            {mesesDisponiveis.map((m) => (
              <option key={m} value={m}>
                {rotuloMes(m)}
              </option>
            ))}
          </select>
        </div>

        {ehMesCorrente ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 adobe-dark:border-emerald-500/30 adobe-dark:bg-emerald-500/15 adobe-dark:text-emerald-300">
            Mês em aberto
          </span>
        ) : (
          <button
            type="button"
            onClick={() => irParaMes(mesCorrente)}
            disabled={navegando}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50 cursor-pointer adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-3"
          >
            Voltar ao mês atual
          </button>
        )}

        <span className="ml-auto text-xs text-neutral-500 adobe-dark:text-adobe-text-lo">
          {navegando
            ? 'Carregando…'
            : `${transacoes.length} ${transacoes.length === 1 ? 'lançamento' : 'lançamentos'} em ${rotuloMesCurto(mes)}`}
        </span>
      </div>

      {/* Cards de Métricas — todos referentes ao mês selecionado */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 adobe-dark:text-adobe-text-lo">
              Balanço do mês
            </span>
            <div className="h-9 w-9 rounded-xl bg-liberty/10 text-liberty-deep flex items-center justify-center adobe-dark:bg-adobe-accent/15 adobe-dark:text-adobe-accent-soft">
              <IconWallet size={20} stroke={2} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-neutral-950 adobe-dark:text-adobe-text-hi">
            {formatCurrency(saldoTotal)}
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-600 flex items-center gap-1 adobe-dark:text-emerald-400">
            <IconTrendingUp size={14} /> Receitas − despesas de {rotuloMesCurto(mes)}
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 adobe-dark:text-adobe-text-lo">
              Receitas do mês (concluídas)
            </span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center adobe-dark:bg-emerald-500/15 adobe-dark:text-emerald-400">
              <IconArrowUpRight size={20} stroke={2} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-neutral-950 adobe-dark:text-adobe-text-hi">
            {formatCurrency(totalReceitas)}
          </p>
          <p className="mt-1 text-xs text-neutral-500 adobe-dark:text-adobe-text-lo">Vendas de veículos e serviços</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 adobe-dark:text-adobe-text-lo">
              Despesas do mês (concluídas)
            </span>
            <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center adobe-dark:bg-rose-500/15 adobe-dark:text-rose-400">
              <IconArrowDownRight size={20} stroke={2} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-neutral-950 adobe-dark:text-adobe-text-hi">
            {formatCurrency(totalDespesas)}
          </p>
          <p className="mt-1 text-xs text-neutral-500 adobe-dark:text-adobe-text-lo">Comissões, manutenção e taxas</p>
        </div>
      </div>

      {/* Tabela de Lançamentos */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-xs overflow-hidden adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <div className="border-b border-neutral-100 p-6 flex flex-wrap items-center justify-between gap-4 adobe-dark:border-adobe-line">
          <div>
            <h3 className="text-base font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">
              Lançamentos de {rotuloMes(mes)}
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5 adobe-dark:text-adobe-text-lo">
              Transações com data dentro deste mês. Use o seletor acima para trocar de período.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(['todos', 'receita', 'despesa'] as const).map((tp) => (
              <button
                key={tp}
                onClick={() => setFilterTipo(tp)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                  filterTipo === tp
                    ? 'bg-neutral-950 text-white adobe-dark:bg-adobe-accent adobe-dark:text-[#0a1720]'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 adobe-dark:bg-adobe-bg-3 adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-4'
                }`}
              >
                {tp === 'todos' ? 'Todos' : tp === 'receita' ? 'Receitas' : 'Despesas'}
              </button>
            ))}
          </div>
        </div>

        {filteredTransacoes.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<IconReceipt size={24} stroke={1.5} />}
              title={`Nenhum lançamento em ${rotuloMes(mes)}`}
              description={
                filterTipo === 'todos'
                  ? 'Este mês ainda não tem transações registradas.'
                  : 'Nenhum lançamento deste tipo neste mês. Tente outro filtro ou outro período.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100 adobe-dark:bg-adobe-bg-3 adobe-dark:text-adobe-text-lo adobe-dark:border-adobe-line">
                <tr>
                  <th className="px-6 py-3.5">Descrição</th>
                  <th className="px-6 py-3.5">Categoria</th>
                  <th className="px-6 py-3.5">Data</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Valor</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700 adobe-dark:divide-adobe-line adobe-dark:text-adobe-text-md">
                {filteredTransacoes.map((t) => {
                  const comprovante = getComprovante(t)
                  return (
                  <tr key={t.id} className="hover:bg-neutral-50/60 transition-colors adobe-dark:hover:bg-adobe-bg-3/60">
                    <td className="px-6 py-4 font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                            t.tipo === 'receita'
                              ? 'bg-emerald-50 text-emerald-600 adobe-dark:bg-emerald-500/15 adobe-dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-600 adobe-dark:bg-rose-500/15 adobe-dark:text-rose-400'
                          }`}
                        >
                          {t.tipo === 'receita' ? (
                            <IconArrowUpRight size={14} />
                          ) : (
                            <IconArrowDownRight size={14} />
                          )}
                        </div>
                        {t.descricao}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 adobe-dark:bg-adobe-bg-3 adobe-dark:text-adobe-text-md">
                        {t.categoria}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-500 adobe-dark:text-adobe-text-lo">
                      {new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          t.status === 'concluido'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 adobe-dark:bg-emerald-500/15 adobe-dark:text-emerald-300 adobe-dark:border-emerald-500/30'
                            : 'bg-amber-50 text-amber-700 border border-amber-200 adobe-dark:bg-amber-500/15 adobe-dark:text-amber-300 adobe-dark:border-amber-500/30'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-black text-sm ${
                        t.tipo === 'receita' ? 'text-emerald-600 adobe-dark:text-emerald-400' : 'text-rose-600 adobe-dark:text-rose-400'
                      }`}
                    >
                      {t.tipo === 'receita' ? '+' : '-'} {formatCurrency(t.valor)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => setComprovanteDe(t)}
                          title={
                            comprovante
                              ? `Comprovante anexado: ${comprovante.fileName}`
                              : 'Anexar comprovante (nota fiscal / recibo)'
                          }
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                            comprovante
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 adobe-dark:border-emerald-500/30 adobe-dark:bg-emerald-500/15 adobe-dark:text-emerald-300 adobe-dark:hover:bg-emerald-500/20'
                              : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-3'
                          }`}
                        >
                          {comprovante ? (
                            <IconCircleCheck size={12} />
                          ) : (
                            <IconPaperclip size={12} />
                          )}
                          Comprovante
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-3"
                        >
                          <IconPencil size={12} /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDelete(t)
                            setRemoverPagamentoVinculado(false)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer adobe-dark:border-rose-500/30 adobe-dark:bg-adobe-bg-2 adobe-dark:text-rose-400 adobe-dark:hover:bg-rose-500/10"
                        >
                          <IconTrash size={12} /> Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Criar / Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 p-8 max-w-2xl w-full space-y-6 max-h-[90vh] overflow-y-auto adobe-dark:bg-adobe-bg-2 adobe-dark:border-adobe-line">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4 adobe-dark:border-adobe-line">
              <h3 className="text-lg font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">
                {editing ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
              </h3>
              <button
                onClick={closeForm}
                className="text-neutral-400 hover:text-neutral-600 text-xs font-bold cursor-pointer adobe-dark:text-adobe-text-lo adobe-dark:hover:text-adobe-text-hi"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Descrição"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Venda de Veículo ou Comissão"
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Tipo *"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TransacaoTipo)}
                >
                  <option value="receita">Receita (+)</option>
                  <option value="despesa">Despesa (-)</option>
                </Select>

                <Input
                  label="Valor (R$)"
                  value={valor}
                  onChange={(e) => setValor(maskMoneyIntuitivo(e.target.value))}
                  placeholder="0,00"
                  inputMode="numeric"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Categoria *"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as TransacaoCategoria)}
                >
                  {TRANSACAO_CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>

                {categoria === 'Outros' && (
                  <Input
                    label="Nome (opcional)"
                    value={categoriaOutrosNome}
                    onChange={(e) => setCategoriaOutrosNome(e.target.value)}
                    placeholder="Ex: Doação, Multa, Aluguel..."
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Data"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
                <Select
                  label="Status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TransacaoStatus)}
                >
                  <option value="concluido">Concluído</option>
                  <option value="pendente">Pendente</option>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 rounded-xl border border-neutral-200 bg-white py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-3"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-neutral-950 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer adobe-dark:bg-adobe-accent adobe-dark:text-[#0a1720] adobe-dark:hover:bg-adobe-accent-deep"
                >
                  {submitting
                    ? 'Salvando...'
                    : editing
                      ? 'Salvar Alterações'
                      : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => {
          setConfirmDelete(null)
          setRemoverPagamentoVinculado(false)
        }}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Remover lançamento?"
        description={
          confirmDelete ? (
            <>
              <p>
                Esta ação é definitiva e não pode ser desfeita. Tem certeza que deseja remover o
                lançamento <strong>{confirmDelete.descricao}</strong> de{' '}
                <strong>{formatCurrency(confirmDelete.valor)}</strong>?
              </p>

              {confirmDelete.origemPagamentoId && (
                <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-liberty/30 bg-liberty/10 p-3 adobe-dark:border-adobe-accent/30 adobe-dark:bg-adobe-accent/10">
                  <input
                    type="checkbox"
                    checked={removerPagamentoVinculado}
                    onChange={(e) => setRemoverPagamentoVinculado(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-liberty focus:ring-liberty"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-liberty-deep adobe-dark:text-adobe-accent-soft">
                      Também remover o pagamento em Cobranças
                    </span>
                    <span className="mt-0.5 block text-[11px] text-neutral-600 adobe-dark:text-adobe-text-md">
                      Este lançamento veio de um pagamento registrado em /dashboard/cobrancas.
                      Marque para remover os dois juntos — se deixar desmarcado, o pagamento
                      continua lá, só o lançamento aqui é removido.
                    </span>
                  </span>
                </label>
              )}
            </>
          ) : null
        }
        confirmLabel="Remover"
        tone="danger"
      />

      <ComprovanteTransacao
        transacao={
          comprovanteDe
            ? {
                id: comprovanteDe.id,
                descricao: comprovanteDe.descricao,
                comprovante: getComprovante(comprovanteDe),
              }
            : null
        }
        onClose={() => setComprovanteDe(null)}
        onChange={(transacaoId, comprovante) =>
          setComprovanteOverrides((prev) => ({ ...prev, [transacaoId]: comprovante }))
        }
      />
    </div>
  )
}
