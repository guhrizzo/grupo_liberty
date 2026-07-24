'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IconNote, IconDownload } from '@tabler/icons-react'
import { updatePropostaStatus, type Proposta } from './actions'
import { Breadcrumb, EmptyState, useToast } from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'

interface PropostasClientProps {
  propostas: Proposta[]
}

export default function PropostasClient({ propostas }: PropostasClientProps) {
  const router = useRouter()
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendente' | 'aceito' | 'recusado'>('todos')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const toast = useToast()

  const handleStatusChange = async (id: string, newStatus: 'aceito' | 'recusado') => {
    setLoadingId(id)

    try {
      const res = await updatePropostaStatus(id, newStatus)
      if (res.error) {
        toast.error(res.error, 'Não foi possível atualizar')
      } else if (res.success) {
        toast.success(res.success, 'Status atualizado')
        router.refresh()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao processar.'
      toast.error(message, 'Erro inesperado')
    } finally {
      setLoadingId(null)
    }
  }

  const handleDownloadPDF = async (id: string) => {
    setDownloadingId(id)
    try {
      const res = await fetch(`/api/propostas/${id}/pdf`)
      if (!res.ok) {
        const errorText = await res.text()
        toast.error(errorText || 'Erro ao gerar PDF.', 'Falha no download')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `proposta-${id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Erro de conexão ao gerar o PDF.', 'Falha no download')
    } finally {
      setDownloadingId(null)
    }
  }

  const filteredPropostas = propostas.filter(p => {
    if (filterStatus === 'todos') return true
    return p.status === filterStatus
  })

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
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Propostas' },
            ]}
          />
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950">
            Gerenciar Propostas
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Gerencie o interesse e as propostas de financiamento/compra dos clientes logados.
          </p>
        </div>

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
          <EmptyState
            icon={<IconNote size={24} stroke={1.5} />}
            title="Nenhuma proposta encontrada"
            description="Aguarde novas propostas ou altere o filtro de status."
          />
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

                {/* Ações */}
                <div className="mt-6 pt-4 border-t border-neutral-100 flex flex-wrap justify-end gap-3">
                  {/* Botão de Download PDF — sempre visível, só ativo se aceito */}
                  <button
                    disabled={p.status !== 'aceito' || downloadingId === p.id}
                    onClick={() => handleDownloadPDF(p.id)}
                    title={p.status !== 'aceito' ? 'Disponível apenas para propostas aceitas' : 'Baixar PDF da proposta'}
                    className={`inline-flex items-center gap-1.5 rounded-lg border text-xs font-bold px-4 py-2 transition-colors ${
                      p.status === 'aceito'
                        ? 'border-neutral-300 hover:bg-neutral-100 text-neutral-700 cursor-pointer'
                        : 'border-neutral-200 text-neutral-400 cursor-not-allowed opacity-60'
                    } disabled:opacity-50`}
                  >
                    <IconDownload size={13} stroke={2.5} />
                    {downloadingId === p.id ? 'Gerando...' : 'Baixar PDF'}
                  </button>

                  {/* Aceitar / Recusar — apenas se pendente */}
                  {p.status === 'pendente' && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
