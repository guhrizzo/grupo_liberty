'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconAlertTriangle,
  IconCalendarDue,
  IconCircleCheck,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconRepeat,
  IconTrash,
} from '@tabler/icons-react'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'
import { deleteTransacao } from '../actions'
import { maskMoneyIntuitivo, moneyFromNumber, parseMoneyIntuitivo } from '../money'
import { hojeNoFuso, rotuloMes, type Mes } from '../periodo'
import {
  createContaFixa,
  deleteContaFixa,
  marcarContaFixaPaga,
  setContaFixaAtiva,
  updateContaFixa,
} from './actions'
import { contasDoMes, type ItemContaDoMes } from './regras'
import type {
  ContaFixa,
  ContaFixaFieldErrors,
  ContaFixaPeriodicidade,
  ContaFixaResponse,
  ContaFixaStatus,
  PagamentoContaFixa,
} from './types'

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const SELO_STATUS: Record<ContaFixaStatus, { rotulo: string; classes: string }> = {
  paga: {
    rotulo: 'Paga',
    classes:
      'border-emerald-200 bg-emerald-50 text-emerald-700 adobe-dark:border-emerald-500/30 adobe-dark:bg-emerald-500/15 adobe-dark:text-emerald-300',
  },
  a_vencer: {
    rotulo: 'A vencer',
    classes:
      'border-neutral-200 bg-neutral-50 text-neutral-600 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-3 adobe-dark:text-adobe-text-md',
  },
  vence_hoje: {
    rotulo: 'Vence hoje',
    classes:
      'border-amber-200 bg-amber-50 text-amber-700 adobe-dark:border-amber-500/30 adobe-dark:bg-amber-500/15 adobe-dark:text-amber-300',
  },
  vencida: {
    rotulo: 'Vencida',
    classes:
      'border-rose-200 bg-rose-50 text-rose-700 adobe-dark:border-rose-500/30 adobe-dark:bg-rose-500/15 adobe-dark:text-rose-300',
  },
}

/** `2026-09-05` → `05/09`. */
function diaMes(data: string): string {
  return data ? `${data.slice(8, 10)}/${data.slice(5, 7)}` : '—'
}

/** `2026-09-05` → `05/09/2026`. */
function dataBR(data: string): string {
  return data ? `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}` : '—'
}

function descricaoPeriodicidade(conta: ContaFixa): string {
  if (conta.periodicidade === 'anual' && conta.mesVencimento) {
    return `Anual — dia ${conta.diaVencimento} de ${NOMES_MESES[conta.mesVencimento - 1].toLowerCase()}`
  }
  return `Mensal — todo dia ${conta.diaVencimento}`
}

function Selo({ status }: { status: ContaFixaStatus }) {
  const { rotulo, classes } = SELO_STATUS[status]
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${classes}`}
    >
      {rotulo}
    </span>
  )
}

const CARD =
  'rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2'
const CARD_ROTULO =
  'text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 adobe-dark:text-adobe-text-lo'
const CARD_VALOR = 'mt-3 text-2xl font-black text-neutral-950 adobe-dark:text-adobe-text-hi'
const BOTAO_ICONE =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-40 cursor-pointer adobe-dark:text-adobe-text-lo adobe-dark:hover:bg-adobe-bg-3 adobe-dark:hover:text-adobe-text-hi'

export default function ContasFixasClient({
  contas,
  pagamentos,
  mes,
  navegando,
}: {
  contas: ContaFixa[]
  pagamentos: PagamentoContaFixa[]
  mes: Mes
  navegando: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<ContaFixaFieldErrors>({})

  const itens = useMemo(
    () => contasDoMes(contas, pagamentos, mes, hojeNoFuso()),
    [contas, pagamentos, mes],
  )

  const totais = useMemo(() => {
    let previsto = 0
    let pago = 0
    for (const item of itens) {
      if (item.pagamento) {
        previsto += item.pagamento.valor
        pago += item.pagamento.valor
      } else {
        previsto += item.conta.valor
      }
    }
    return { previsto, pago, aberto: previsto - pago }
  }, [itens])

  const qtdAbertas = itens.filter((i) => !i.pagamento).length
  const qtdVencidas = itens.filter((i) => i.status === 'vencida').length

  // ─── Formulário de conta ──────────────────────────────────────────────────
  const [formAberto, setFormAberto] = useState(false)
  const [editando, setEditando] = useState<ContaFixa | null>(null)
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('')
  const [valor, setValor] = useState('')
  const [periodicidade, setPeriodicidade] = useState<ContaFixaPeriodicidade>('mensal')
  const [diaVencimento, setDiaVencimento] = useState('')
  const [mesVencimento, setMesVencimento] = useState('')
  const [observacao, setObservacao] = useState('')

  function abrirNovaConta() {
    setEditando(null)
    setNome('')
    setCategoria('')
    setValor('')
    setPeriodicidade('mensal')
    setDiaVencimento('')
    // O Select exibe a primeira opção quando o valor é vazio — começa no mês
    // em tela para o que aparece ser o que é enviado.
    setMesVencimento(String(Number(mes.slice(5))))
    setObservacao('')
    setFieldErrors({})
    setFormAberto(true)
  }

  function abrirEdicao(conta: ContaFixa) {
    setEditando(conta)
    setNome(conta.nome)
    setCategoria(conta.categoria === 'Outros' ? '' : conta.categoria)
    setValor(moneyFromNumber(conta.valor))
    setPeriodicidade(conta.periodicidade)
    setDiaVencimento(String(conta.diaVencimento))
    setMesVencimento(String(conta.mesVencimento ?? Number(mes.slice(5))))
    setObservacao(conta.observacao ?? '')
    setFieldErrors({})
    setFormAberto(true)
  }

  function fecharForm() {
    if (submitting) return
    setFormAberto(false)
    setEditando(null)
  }

  /** Roda uma action, mostra o toast e atualiza os dados do servidor. */
  async function executar(acao: () => Promise<ContaFixaResponse>): Promise<boolean> {
    setSubmitting(true)
    try {
      const result = await acao()
      if (result.error) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.error)
        router.refresh()
        return false
      }
      setFieldErrors({})
      if (result.success) toast.success(result.success)
      router.refresh()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  async function salvarConta(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('categoria', categoria)
    // Envia o número já convertido (como o FinanceiroClient): a máscara exibe
    // "1.500", que o parser do servidor leria como 1,5.
    fd.set('valor', String(parseMoneyIntuitivo(valor)))
    fd.set('periodicidade', periodicidade)
    fd.set('diaVencimento', diaVencimento)
    fd.set('mesVencimento', mesVencimento)
    fd.set('observacao', observacao)
    const ok = await executar(() =>
      editando ? updateContaFixa(editando.id, fd) : createContaFixa(fd),
    )
    if (ok) {
      setFormAberto(false)
      setEditando(null)
    }
  }

  // ─── Marcar como paga ─────────────────────────────────────────────────────
  const [pagando, setPagando] = useState<ItemContaDoMes | null>(null)
  const [valorPago, setValorPago] = useState('')
  const [dataPagamento, setDataPagamento] = useState('')

  function abrirPagamento(item: ItemContaDoMes) {
    setPagando(item)
    setValorPago(moneyFromNumber(item.conta.valor))
    setDataPagamento(hojeNoFuso())
    setFieldErrors({})
  }

  async function confirmarPagamento(e: React.FormEvent) {
    e.preventDefault()
    if (!pagando) return
    const fd = new FormData()
    fd.set('valor', String(parseMoneyIntuitivo(valorPago)))
    fd.set('data', dataPagamento)
    const ok = await executar(() => marcarContaFixaPaga(pagando.conta.id, mes, fd))
    if (ok) setPagando(null)
  }

  // ─── Desfazer pagamento / excluir / ativar ────────────────────────────────
  const [desfazendo, setDesfazendo] = useState<ItemContaDoMes | null>(null)
  const [excluindo, setExcluindo] = useState<ContaFixa | null>(null)

  async function confirmarDesfazer() {
    if (!desfazendo?.pagamento) return
    const transacaoId = desfazendo.pagamento.transacaoId
    const ok = await executar(async () => {
      const r = await deleteTransacao(transacaoId)
      return r.error ? { error: r.error } : { success: 'Pagamento desfeito e lançamento removido.' }
    })
    if (ok) setDesfazendo(null)
  }

  async function confirmarExclusao() {
    if (!excluindo) return
    const id = excluindo.id
    const ok = await executar(() => deleteContaFixa(id))
    if (ok) setExcluindo(null)
  }

  const ocupado = submitting || navegando

  return (
    <div className="space-y-6">
      {/* Cards do mês */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={CARD}>
          <div className="flex items-center justify-between">
            <span className={CARD_ROTULO}>Total previsto</span>
            <div className="h-9 w-9 rounded-xl bg-liberty/10 text-liberty-deep flex items-center justify-center adobe-dark:bg-adobe-accent/15 adobe-dark:text-adobe-accent-soft">
              <IconRepeat size={20} stroke={2} />
            </div>
          </div>
          <p className={CARD_VALOR}>{formatCurrency(totais.previsto)}</p>
          <p className="mt-1 text-xs text-neutral-500 adobe-dark:text-adobe-text-lo">
            {itens.length} {itens.length === 1 ? 'conta' : 'contas'} em {rotuloMes(mes)}
          </p>
        </div>

        <div className={CARD}>
          <div className="flex items-center justify-between">
            <span className={CARD_ROTULO}>Pago</span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center adobe-dark:bg-emerald-500/15 adobe-dark:text-emerald-400">
              <IconCircleCheck size={20} stroke={2} />
            </div>
          </div>
          <p className={CARD_VALOR}>{formatCurrency(totais.pago)}</p>
          <p className="mt-1 text-xs text-neutral-500 adobe-dark:text-adobe-text-lo">
            Já lançado como despesa no Financeiro
          </p>
        </div>

        <div className={CARD}>
          <div className="flex items-center justify-between">
            <span className={CARD_ROTULO}>Em aberto</span>
            <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center adobe-dark:bg-rose-500/15 adobe-dark:text-rose-400">
              <IconCalendarDue size={20} stroke={2} />
            </div>
          </div>
          <p className={CARD_VALOR}>{formatCurrency(totais.aberto)}</p>
          <p
            className={`mt-1 text-xs flex items-center gap-1 ${
              qtdVencidas > 0
                ? 'font-semibold text-rose-600 adobe-dark:text-rose-400'
                : 'text-neutral-500 adobe-dark:text-adobe-text-lo'
            }`}
          >
            {qtdVencidas > 0 && <IconAlertTriangle size={14} />}
            {qtdAbertas === 0
              ? 'Nada pendente neste mês'
              : qtdVencidas > 0
                ? `${qtdVencidas} ${qtdVencidas === 1 ? 'vencida' : 'vencidas'} de ${qtdAbertas} em aberto`
                : `${qtdAbertas} ${qtdAbertas === 1 ? 'conta' : 'contas'} a pagar`}
          </p>
        </div>
      </div>

      {/* Contas do mês */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-xs overflow-hidden adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <div className="border-b border-neutral-100 p-6 adobe-dark:border-adobe-line">
          <h3 className="text-base font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">
            Contas de {rotuloMes(mes)}
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5 adobe-dark:text-adobe-text-lo">
            Ao marcar como paga, a despesa entra nos lançamentos na data do pagamento.
          </p>
        </div>

        {itens.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<IconRepeat size={24} stroke={1.5} />}
              title={`Nenhuma conta fixa em ${rotuloMes(mes)}`}
              description={
                contas.length === 0
                  ? 'Cadastre as contas que se repetem — aluguel, luz, internet, contador — para acompanhar o que falta pagar.'
                  : 'Nenhuma conta ativa vence neste mês.'
              }
              action={
                contas.length === 0 ? (
                  <Button variant="liberty" size="sm" leftIcon={<IconPlus size={16} />} onClick={abrirNovaConta}>
                    Nova conta
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 adobe-dark:divide-adobe-line">
            {itens.map((item) => (
              <li
                key={item.conta.id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-neutral-900 adobe-dark:text-adobe-text-hi">
                      {item.conta.nome}
                    </span>
                    <Selo status={item.status} />
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 adobe-dark:text-adobe-text-lo">
                    {item.conta.categoria} · vence {diaMes(item.vencimento)}
                    {item.pagamento && ` · pago em ${dataBR(item.pagamento.data)}`}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span className="text-sm font-black text-neutral-950 adobe-dark:text-adobe-text-hi">
                    {formatCurrency(item.pagamento ? item.pagamento.valor : item.conta.valor)}
                  </span>
                  {item.pagamento ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={ocupado}
                      onClick={() => setDesfazendo(item)}
                    >
                      Desfazer
                    </Button>
                  ) : (
                    <Button
                      variant="liberty"
                      size="sm"
                      disabled={ocupado}
                      leftIcon={<IconCircleCheck size={16} />}
                      onClick={() => abrirPagamento(item)}
                    >
                      Marcar como paga
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Contas cadastradas */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-xs overflow-hidden adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <div className="border-b border-neutral-100 p-6 flex flex-wrap items-center justify-between gap-4 adobe-dark:border-adobe-line">
          <div>
            <h3 className="text-base font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">
              Contas cadastradas
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5 adobe-dark:text-adobe-text-lo">
              Todas as contas fixas da empresa. Contas desativadas deixam de aparecer nos meses.
            </p>
          </div>
          <Button
            variant="liberty"
            size="sm"
            leftIcon={<IconPlus size={16} />}
            onClick={abrirNovaConta}
            disabled={ocupado}
          >
            Nova conta
          </Button>
        </div>

        {contas.length === 0 ? (
          <p className="p-6 text-xs text-neutral-500 adobe-dark:text-adobe-text-lo">
            Nenhuma conta fixa cadastrada ainda.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 adobe-dark:divide-adobe-line">
            {contas.map((conta) => (
              <li
                key={conta.id}
                className={`flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between ${
                  conta.ativa ? '' : 'opacity-60'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-neutral-900 adobe-dark:text-adobe-text-hi">
                      {conta.nome}
                    </span>
                    {!conta.ativa && (
                      <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-3 adobe-dark:text-adobe-text-lo">
                        Inativa
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 adobe-dark:text-adobe-text-lo">
                    {conta.categoria} · {descricaoPeriodicidade(conta)}
                  </p>
                  {conta.observacao && (
                    <p className="mt-1 text-xs text-neutral-400 adobe-dark:text-adobe-text-lo break-words">
                      {conta.observacao}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span className="text-sm font-black text-neutral-950 adobe-dark:text-adobe-text-hi">
                    {formatCurrency(conta.valor)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className={BOTAO_ICONE}
                      disabled={ocupado}
                      onClick={() => abrirEdicao(conta)}
                      aria-label={`Editar ${conta.nome}`}
                      title="Editar"
                    >
                      <IconPencil size={16} />
                    </button>
                    <button
                      type="button"
                      className={BOTAO_ICONE}
                      disabled={ocupado}
                      onClick={() => executar(() => setContaFixaAtiva(conta.id, !conta.ativa))}
                      aria-label={conta.ativa ? `Desativar ${conta.nome}` : `Reativar ${conta.nome}`}
                      title={conta.ativa ? 'Desativar' : 'Reativar'}
                    >
                      {conta.ativa ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
                    </button>
                    <button
                      type="button"
                      className={`${BOTAO_ICONE} hover:text-rose-600 adobe-dark:hover:text-rose-400`}
                      disabled={ocupado}
                      onClick={() => setExcluindo(conta)}
                      aria-label={`Excluir ${conta.nome}`}
                      title="Excluir"
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal: nova conta / editar */}
      <Modal
        open={formAberto}
        onClose={fecharForm}
        title={editando ? 'Editar conta fixa' : 'Nova conta fixa'}
        size="lg"
      >
        <form onSubmit={salvarConta} className="mt-4 space-y-5">
          <Input
            label="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Aluguel da loja"
            error={fieldErrors.nome}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Aluguel, Energia, Internet"
            />
            <Input
              label="Valor previsto (R$)"
              value={valor}
              onChange={(e) => setValor(maskMoneyIntuitivo(e.target.value))}
              placeholder="0,00"
              inputMode="decimal"
              error={fieldErrors.valor}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Repete"
              value={periodicidade}
              onChange={(e) => setPeriodicidade(e.target.value as ContaFixaPeriodicidade)}
            >
              <option value="mensal">Todo mês</option>
              <option value="anual">Uma vez por ano</option>
            </Select>
            <Input
              label="Dia do vencimento"
              type="number"
              min={1}
              max={31}
              value={diaVencimento}
              onChange={(e) => setDiaVencimento(e.target.value)}
              placeholder="1 a 31"
              error={fieldErrors.diaVencimento}
              required
            />
            {periodicidade === 'anual' && (
              <Select
                label="Mês do vencimento"
                value={mesVencimento}
                onChange={(e) => setMesVencimento(e.target.value)}
                error={fieldErrors.mesVencimento}
              >
                {NOMES_MESES.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <Textarea
            label="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex: débito automático no Itaú, contrato até 2027"
            rows={2}
          />

          {!editando && (
            <p className="text-[11px] text-neutral-500 adobe-dark:text-adobe-text-lo">
              A conta passa a aparecer a partir do mês atual.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={fecharForm} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="liberty" loading={submitting}>
              {editando ? 'Salvar alterações' : 'Cadastrar conta'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: marcar como paga */}
      <Modal
        open={!!pagando}
        onClose={() => !submitting && setPagando(null)}
        title={pagando ? `Pagar ${pagando.conta.nome}` : ''}
        description={
          pagando
            ? `Referente a ${rotuloMes(mes)} · vence ${dataBR(pagando.vencimento)}. A despesa entra no Financeiro na data do pagamento.`
            : undefined
        }
      >
        <form onSubmit={confirmarPagamento} className="mt-4 space-y-5">
          <Input
            label="Valor pago (R$)"
            value={valorPago}
            onChange={(e) => setValorPago(maskMoneyIntuitivo(e.target.value))}
            inputMode="decimal"
            error={fieldErrors.valor}
            required
          />
          <Input
            label="Data do pagamento"
            type="date"
            value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
            error={fieldErrors.data}
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPagando(null)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="liberty" loading={submitting}>
              Confirmar pagamento
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!desfazendo}
        onClose={() => !submitting && setDesfazendo(null)}
        onConfirm={confirmarDesfazer}
        loading={submitting}
        title="Desfazer pagamento?"
        description={
          desfazendo?.pagamento
            ? `O lançamento de ${formatCurrency(desfazendo.pagamento.valor)} pago em ${dataBR(desfazendo.pagamento.data)} será removido do Financeiro, e ${desfazendo.conta.nome} volta a ficar em aberto em ${rotuloMes(mes)}.`
            : undefined
        }
        confirmLabel="Desfazer"
        tone="danger"
      />

      <ConfirmDialog
        open={!!excluindo}
        onClose={() => !submitting && setExcluindo(null)}
        onConfirm={confirmarExclusao}
        loading={submitting}
        title="Excluir conta fixa?"
        description={
          excluindo
            ? `${excluindo.nome} deixa de aparecer em todos os meses. Os pagamentos já lançados continuam no Financeiro. Se quiser só pausar, use "Desativar".`
            : undefined
        }
        confirmLabel="Excluir"
        tone="danger"
      />
    </div>
  )
}
