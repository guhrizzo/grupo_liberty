'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IconNote } from '@tabler/icons-react'
import { updatePropostaStatus, type Proposta } from './actions'

interface PropostasClientProps {
  propostas: Proposta[]
}

export default function PropostasClient({ propostas }: PropostasClientProps) {
  const router = useRouter()
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendente' | 'aceito' | 'recusado'>('todos')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleStatusChange = async (id: string, newStatus: 'aceito' | 'recusado') => {
    setLoadingId(id)
    setMessage(null)

    try {
      const res = await updatePropostaStatus(id, newStatus)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else if (res.success) {
        setMessage({ type: 'success', text: res.success })
        router.refresh()
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao processar.' })
    } finally {
      setLoadingId(null)
    }
  }

  const filteredPropostas = propostas.filter(p => {
    if (filterStatus === 'todos') return true
    return p.status === filterStatus
  })

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Link href="/dashboard" className="hover:text-black hover:underline transition-all">
              Dashboard
            </Link>
            <span>/</span>
            <span className="font-medium text-neutral-900">Propostas</span>
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950">
            Gerenciar Propostas
          </h1>
          <p className="text-sm text-neutral-550">
            Gerencie o interesse e as propostas de financiamento/compra dos clientes logados.
          </p>
        </div>

        {/* Feedback Alert */}
        {message && (
          <div
            className={`mb-6 rounded-lg p-4 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Filtros por Status */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(['todos', 'pendente', 'aceito', 'recusado'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                filterStatus === status
                  ? 'bg-neutral-950 text-white shadow-xs'
                  : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {status === 'todos' ? 'Todas' : status}
            </button>
          ))}
        </div>

        {/* Listagem das Propostas */}
        {filteredPropostas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center">
              <IconNote size={24} stroke={1.5} className="text-neutral-400" />
            </div>
            <p className="text-sm font-medium text-neutral-500">Nenhuma proposta encontrada</p>
            <p className="text-xs text-neutral-400 mt-1">Aguarde novas propostas ou altere o filtro de status.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPropostas.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs transition-shadow hover:shadow-md"
              >
                {/* Header da Proposta */}
                <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-neutral-100 pb-4 mb-4">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest block">
                      Enviada em {formatDate(p.created_at)}
                    </span>
                    <h3 className="text-base font-bold text-neutral-900 mt-1">
                      {p.user_name} ({p.user_email})
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-neutral-500">
                      Status:
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                        p.status === 'pendente'
                          ? 'bg-amber-50 text-amber-805 border border-amber-200'
                          : p.status === 'aceito'
                          ? 'bg-emerald-50 text-emerald-805 border border-emerald-200'
                          : 'bg-rose-50 text-rose-805 border border-rose-200'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>

                {/* Conteúdo da Proposta */}
                <div className="grid gap-6 md:grid-cols-3 items-start">
                  
                  {/* Veículo de Interesse */}
                  <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">
                      Veículo
                    </span>
                    {p.veiculos ? (
                      <div className="mt-1.5">
                        <h4 className="text-sm font-bold text-neutral-905">
                          {p.veiculos.marca} {p.veiculos.modelo}
                        </h4>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Preço sugerido: {formatCurrency(p.veiculos.preco)}
                        </p>
                        <Link
                          href={`/veiculos/${p.veiculo_id}`}
                          target="_blank"
                          className="inline-block text-xs font-semibold text-neutral-600 hover:text-black underline mt-2.5"
                        >
                          Ver veículo
                        </Link>
                      </div>
                    ) : (
                      <p className="text-xs text-rose-600 mt-1">Veículo removido do catálogo.</p>
                    )}
                  </div>

                  {/* Valor Proposto */}
                  <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">
                      Valor Ofertado
                    </span>
                    <p className="text-lg font-black text-neutral-950 mt-1">
                      {p.valor ? formatCurrency(p.valor) : 'Sem oferta de preço'}
                    </p>
                    {p.valor && p.veiculos && (
                      <p className="text-[10px] font-semibold text-neutral-500 mt-1">
                        Diferença: {formatCurrency(p.valor - p.veiculos.preco)}
                      </p>
                    )}
                  </div>

                  {/* Mensagem */}
                  <div className="md:col-span-1">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest block">
                      Mensagem do Cliente
                    </span>
                    <p className="text-sm text-neutral-600 mt-2 leading-relaxed whitespace-pre-line bg-neutral-50/50 p-3 rounded-lg border border-neutral-100">
                      {p.mensagem}
                    </p>
                  </div>
                </div>

                {/* Ações (Apenas se pendente) */}
                {p.status === 'pendente' && (
                  <div className="mt-6 pt-4 border-t border-neutral-100 flex justify-end gap-3">
                    <button
                      disabled={loadingId === p.id}
                      onClick={() => handleStatusChange(p.id, 'recusado')}
                      className="rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold px-4 py-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Recusar Proposta
                    </button>
                    <button
                      disabled={loadingId === p.id}
                      onClick={() => handleStatusChange(p.id, 'aceito')}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      Aceitar Proposta
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
