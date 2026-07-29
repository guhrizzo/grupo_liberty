'use client'

import { useMemo, useState } from 'react'
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
import {
  TRANSACAO_CATEGORIAS,
  type Transacao,
  type TransacaoCategoria,
  type TransacaoResponse,
  type TransacaoStatus,
  type TransacaoTipo,
} from './types'

export default function FinanceiroClient({
  initialTransacoes,
}: {
  initialTransacoes: Transacao[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [transacoes, setTransacoes] = useState<Transacao[]>(initialTransacoes)
  const [filterTipo, setFilterTipo] = useState<'todos' | 'receita' | 'despesa'>('todos')
  const [submitting, setSubmitting] = useState(false)

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Transacao | null>(null)

  // Form fields
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<TransacaoCategoria>('Venda de Veículo')
  const [tipo, setTipo] = useState<TransacaoTipo>('receita')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState<TransacaoStatus>('concluido')

  // Confirmação de exclusão
  const [confirmDelete, setConfirmDelete] = useState<Transacao | null>(null)

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

  const filteredTransacoes = useMemo(
    () =>
      transacoes.filter((t) => {
        if (filterTipo === 'todos') return true
        return t.tipo === filterTipo
      }),
    [transacoes, filterTipo],
  )

  function resetForm() {
    setDescricao('')
    setValor('')
    setCategoria('Venda de Veículo')
    setTipo('receita')
    setData(new Date().toISOString().split('T')[0])
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
    setCategoria(t.categoria)
    setTipo(t.tipo)
    setValor(moneyFromNumber(t.valor))
    setData(t.data || new Date().toISOString().split('T')[0])
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

    const fd = new FormData()
    fd.append('descricao', descricao.trim())
    fd.append('categoria', categoria)
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

  async function handleDelete(t: Transacao) {
    if (submitting) return
    setSubmitting(true)
    const target = t
    setConfirmDelete(null)

    // otimista
    setTransacoes((prev) => prev.filter((x) => x.id !== target.id))

    try {
      const result = await deleteTransacao(target.id)
      if (result.error) {
        toast.error(result.error)
        router.refresh()
      } else {
        toast.success(result.success || 'Lançamento removido.')
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover.')
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Financeiro' }]} />
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950">
            Gestão Financeira
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Controle de entradas, saídas, faturamento e balanço das operações da Liberty Car.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-neutral-800 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <IconPlus size={16} stroke={2.5} />
          Novo Lançamento
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
              Balanço Geral
            </span>
            <div className="h-9 w-9 rounded-xl bg-liberty/10 text-liberty-deep flex items-center justify-center">
              <IconWallet size={20} stroke={2} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-neutral-950">
            {formatCurrency(saldoTotal)}
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-600 flex items-center gap-1">
            <IconTrendingUp size={14} /> Saldo acumulado atualizado
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
              Receitas (Concluídas)
            </span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IconArrowUpRight size={20} stroke={2} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-neutral-950">
            {formatCurrency(totalReceitas)}
          </p>
          <p className="mt-1 text-xs text-neutral-500">Vendas de veículos e serviços</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
              Despesas (Concluídas)
            </span>
            <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <IconArrowDownRight size={20} stroke={2} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-neutral-950">
            {formatCurrency(totalDespesas)}
          </p>
          <p className="mt-1 text-xs text-neutral-500">Comissões, manutenção e taxas</p>
        </div>
      </div>

      {/* Tabela de Lançamentos */}
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-neutral-100 p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-neutral-900">Histórico de Lançamentos</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Últimas transações financeiras registradas no sistema.</p>
          </div>

          <div className="flex items-center gap-2">
            {(['todos', 'receita', 'despesa'] as const).map((tp) => (
              <button
                key={tp}
                onClick={() => setFilterTipo(tp)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                  filterTipo === tp
                    ? 'bg-neutral-950 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
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
              title="Nenhuma transação encontrada"
              description="Nenhum lançamento corresponde ao filtro selecionado."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                <tr>
                  <th className="px-6 py-3.5">Descrição</th>
                  <th className="px-6 py-3.5">Categoria</th>
                  <th className="px-6 py-3.5">Data</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Valor</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
                {filteredTransacoes.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-neutral-900">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                            t.tipo === 'receita'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-rose-50 text-rose-600'
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
                      <span className="inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                        {t.categoria}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-500">
                      {new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          t.status === 'concluido'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-black text-sm ${
                        t.tipo === 'receita' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {t.tipo === 'receita' ? '+' : '-'} {formatCurrency(t.valor)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
                        >
                          <IconPencil size={12} /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(t)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <IconTrash size={12} /> Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Criar / Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 p-6 max-w-lg w-full space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <h3 className="text-base font-bold text-neutral-900">
                {editing ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
              </h3>
              <button
                onClick={closeForm}
                className="text-neutral-400 hover:text-neutral-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Descrição *"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Venda de Veículo ou Comissão"
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Tipo *"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TransacaoTipo)}
                >
                  <option value="receita">Receita (+)</option>
                  <option value="despesa">Despesa (-)</option>
                </Select>

                <Input
                  label="Valor (R$) *"
                  value={valor}
                  onChange={(e) => setValor(maskMoneyIntuitivo(e.target.value))}
                  placeholder="0,00"
                  inputMode="numeric"
                  required
                />
              </div>

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

              <div className="grid grid-cols-2 gap-3">
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
                  className="flex-1 rounded-xl border border-neutral-200 bg-white py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-neutral-950 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Remover lançamento?"
        description={
          confirmDelete ? (
            <>
              Esta ação é definitiva e não pode ser desfeita. Tem certeza que deseja remover o
              lançamento <strong>{confirmDelete.descricao}</strong> de{' '}
              <strong>{formatCurrency(confirmDelete.valor)}</strong>?
            </>
          ) : null
        }
        confirmLabel="Remover"
        tone="danger"
      />
    </div>
  )
}
