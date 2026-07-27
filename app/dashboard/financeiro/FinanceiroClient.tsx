'use client'

import { useState } from 'react'
import {
  IconCurrencyDollar,
  IconTrendingUp,
  IconTrendingDown,
  IconReceipt,
  IconWallet,
  IconArrowUpRight,
  IconArrowDownRight,
  IconPlus,
  IconCalendar,
  IconFilter,
  IconBuildingBank,
} from '@tabler/icons-react'
import { Breadcrumb, EmptyState, useToast } from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'

type Transacao = {
  id: string
  descricao: string
  categoria: 'Venda de Veículo' | 'Comissão' | 'Manutenção' | 'Documentação' | 'Serviço Legal' | 'Outros'
  tipo: 'receita' | 'despesa'
  valor: number
  data: string
  status: 'concluido' | 'pendente'
}

const DEMO_TRANSACOES: Transacao[] = [
  {
    id: '1',
    descricao: 'Venda — Toyota Corolla XEi 2.0',
    categoria: 'Venda de Veículo',
    tipo: 'receita',
    valor: 118000,
    data: '2026-07-25',
    status: 'concluido',
  },
  {
    id: '2',
    descricao: 'Comissão Vendedor — Honda Civic Touring',
    categoria: 'Comissão',
    tipo: 'despesa',
    valor: 3500,
    data: '2026-07-24',
    status: 'concluido',
  },
  {
    id: '3',
    descricao: 'Revisão Geral e Polimento — Jeep Compass',
    categoria: 'Manutenção',
    tipo: 'despesa',
    valor: 1850,
    data: '2026-07-22',
    status: 'concluido',
  },
  {
    id: '4',
    descricao: 'Taxas de Transferência e Emplacamento',
    categoria: 'Documentação',
    tipo: 'despesa',
    valor: 920,
    data: '2026-07-20',
    status: 'pendente',
  },
  {
    id: '5',
    descricao: 'Venda — Jeep Compass Longitude',
    categoria: 'Venda de Veículo',
    tipo: 'receita',
    valor: 145000,
    data: '2026-07-18',
    status: 'concluido',
  },
]

export default function FinanceiroClient() {
  const toast = useToast()
  const [transacoes, setTransacoes] = useState<Transacao[]>(DEMO_TRANSACOES)
  const [filterTipo, setFilterTipo] = useState<'todos' | 'receita' | 'despesa'>('todos')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Formulário Nova Transação
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<Transacao['categoria']>('Venda de Veículo')
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('receita')
  const [valor, setValor] = useState('')

  const totalReceitas = transacoes
    .filter((t) => t.tipo === 'receita' && t.status === 'concluido')
    .reduce((acc, t) => acc + t.valor, 0)

  const totalDespesas = transacoes
    .filter((t) => t.tipo === 'despesa' && t.status === 'concluido')
    .reduce((acc, t) => acc + t.valor, 0)

  const saldoTotal = totalReceitas - totalDespesas

  const filteredTransacoes = transacoes.filter((t) => {
    if (filterTipo === 'todos') return true
    return t.tipo === filterTipo
  })

  const handleAddTransacao = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedValor = parseFloat(valor.replace(',', '.'))
    if (!descricao || isNaN(parsedValor) || parsedValor <= 0) {
      toast.error('Preencha os campos corretamente.', 'Erro no formulário')
      return
    }

    const nova: Transacao = {
      id: Date.now().toString(),
      descricao,
      categoria,
      tipo,
      valor: parsedValor,
      data: new Date().toISOString().split('T')[0],
      status: 'concluido',
    }

    setTransacoes([nova, ...transacoes])
    toast.success('Lançamento registrado com sucesso!')
    setDescricao('')
    setValor('')
    setIsModalOpen(false)
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
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-neutral-800 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <IconPlus size={16} stroke={2.5} />
          Novo Lançamento
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Saldo Líquido */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-450">
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

        {/* Total Receitas */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-450">
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

        {/* Total Despesas */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-450">
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
            {(['todos', 'receita', 'despesa'] as const).map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFilterTipo(tipo)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                  filterTipo === tipo
                    ? 'bg-neutral-950 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {tipo === 'todos' ? 'Todos' : tipo === 'receita' ? 'Receitas' : 'Despesas'}
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
              <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-450 border-b border-neutral-100">
                <tr>
                  <th className="px-6 py-3.5">Descrição</th>
                  <th className="px-6 py-3.5">Categoria</th>
                  <th className="px-6 py-3.5">Data</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
                {filteredTransacoes.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-neutral-900 flex items-center gap-2.5">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Novo Lançamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <h3 className="text-base font-bold text-neutral-900">Novo Lançamento Financeiro</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTransacao} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Venda de Veículo ou Comissão"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-xs text-neutral-900 focus:border-neutral-950 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Tipo
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as 'receita' | 'despesa')}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-950 focus:bg-white focus:outline-none"
                  >
                    <option value="receita">Receita (+)</option>
                    <option value="despesa">Despesa (-)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0.00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-xs text-neutral-900 focus:border-neutral-950 focus:bg-white focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Categoria
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as Transacao['categoria'])}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-900 focus:border-neutral-950 focus:bg-white focus:outline-none"
                >
                  <option value="Venda de Veículo">Venda de Veículo</option>
                  <option value="Comissão">Comissão</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Documentação">Documentação</option>
                  <option value="Serviço Legal">Serviço Legal</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-xl border border-neutral-200 bg-white py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-neutral-950 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-neutral-800 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
