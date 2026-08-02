'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  IconArrowLeft,
  IconCalendar,
  IconCar,
  IconCash,
  IconDownload,
  IconMail,
  IconPencil,
  IconPhone,
  IconPlus,
  IconTrash,
  IconSearch,
  IconWallet,
  IconX,
} from '@tabler/icons-react'
import { deletePropostaRegistrada, type PropostaRegistrada } from './actions'
import { Breadcrumb, EmptyState, ConfirmDialog, useToast } from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'

interface PropostasRegistradasClientProps {
  propostas: PropostaRegistrada[]
}

const STATUS_TONE: Record<PropostaRegistrada['status'], string> = {
  pendente: 'bg-amber-50 text-amber-800 border-amber-200',
  aceito: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  recusado: 'bg-rose-50 text-rose-800 border-rose-200',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const MES_LABEL = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

function mesKey(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function mesLabel(key: string) {
  const label = MES_LABEL.format(new Date(`${key}-01T00:00:00`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function PropostasRegistradasClient({ propostas }: PropostasRegistradasClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [searchNome, setSearchNome] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const hasActiveFilters = Boolean(searchNome.trim() || selectedMonth)

  const filtered = useMemo(() => {
    const q = searchNome.trim().toLowerCase()
    return propostas.filter((p) => {
      if (q && !p.nome.toLowerCase().includes(q)) return false
      if (selectedMonth && mesKey(p.created_at) !== selectedMonth) return false
      return true
    })
  }, [propostas, searchNome, selectedMonth])

  const comissaoTotal = useMemo(
    () => filtered.reduce((acc, p) => acc + (p.comissao_vendedor ?? 0), 0),
    [filtered],
  )

  const grupos = useMemo(() => {
    const map = new Map<string, PropostaRegistrada[]>()
    for (const p of filtered) {
      const key = mesKey(p.created_at)
      const arr = map.get(key) ?? []
      arr.push(p)
      map.set(key, arr)
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => ({
        key,
        label: mesLabel(key),
        items,
        comissaoTotal: items.reduce((acc, p) => acc + (p.comissao_vendedor ?? 0), 0),
      }))
  }, [filtered])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setConfirmDeleteId(null)
    try {
      const res = await deletePropostaRegistrada(id)
      if (res.error) {
        toast.error(res.error, 'Não foi possível excluir')
      } else if (res.success) {
        toast.success(res.success, 'Proposta excluída')
        router.refresh()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao processar.'
      toast.error(message, 'Erro inesperado')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownloadPdf = async (p: PropostaRegistrada) => {
    setDownloadingId(p.id)
    try {
      const payload = {
        veiculo_id: '',
        nome: p.nome,
        cpf: p.cpf ?? '',
        telefone: p.telefone,
        email: p.email,
        valor: p.valor,
        status: p.status,
        cliente_data: p.cliente_data,
        numero_contrato: p.numero_contrato,
        veiculo_marca: p.veiculo_marca,
        veiculo_modelo: p.veiculo_modelo,
        veiculo_ano: p.veiculo_ano,
        veiculo_placa: p.veiculo_placa,
        veiculo_valor_fipe: p.veiculo_valor_fipe,
        valor_estimado_divida: p.valor_estimado_divida,
        valor_ipva: p.valor_ipva,
        valor_licenciamento: p.valor_licenciamento,
        valor_multas: p.valor_multas,
        valor_parcela: p.valor_parcela,
        parcelas_totais: p.parcelas_totais,
        parcelas_pagas: p.parcelas_pagas,
        parcelas_atrasadas: p.parcelas_atrasadas,
        banco: p.banco,
        pecasConserto: p.pecas_conserto ?? [],
        proposta_previa: p.proposta_previa,
      }

      const res = await fetch('/api/propostas/preview-pdf-autorizacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errorText = await res.text()
        toast.error(errorText || 'Erro ao gerar PDF.', 'Falha no download')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `proposta-${(p.numero_contrato ?? p.id).replace(/^#/, '')}.pdf`
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

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Propostas', href: '/dashboard/propostas' },
            { label: 'Registros' },
          ]}
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950">
              Propostas Registradas
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Propostas cadastradas manualmente pela equipe, com a comissão do vendedor em destaque.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/propostas"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
            >
              <IconArrowLeft size={14} stroke={2.5} />
              Propostas de clientes
            </Link>
            <button
              type="button"
              onClick={() => router.push('/dashboard/propostas/nova')}
              className="inline-flex items-center gap-2 rounded-lg bg-liberty text-white px-4 py-2 text-xs font-bold shadow-sm transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer hover:bg-liberty-deep"
            >
              <IconPlus size={15} />
              Nova proposta
            </button>
          </div>
        </div>
      </div>

      {/* Resumo de comissão */}
      <div className="rounded-xl border border-liberty/30 bg-liberty/5 p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-liberty/15 text-liberty-deep">
              <IconWallet size={20} stroke={2} />
            </span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-liberty-deep/70">
                Comissão total {hasActiveFilters ? '(filtrada)' : ''}
              </p>
              <p className="text-2xl font-black leading-tight text-liberty-deep">
                {formatCurrency(comissaoTotal)}
              </p>
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            {filtered.length} proposta{filtered.length === 1 ? '' : 's'} registrada
            {filtered.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Busca + filtro por mês */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchNome}
            onChange={(e) => setSearchNome(e.target.value)}
            placeholder="Buscar por cliente..."
            className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors"
          />
        </div>

        <div className="relative">
          <IconCalendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 focus:border-neutral-950 focus:outline-none transition-colors cursor-pointer"
            aria-label="Filtrar por mês"
          />
        </div>

        {selectedMonth && (
          <button
            type="button"
            onClick={() => setSelectedMonth('')}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition-ui cursor-pointer"
          >
            <IconX size={13} stroke={2.5} />
            {mesLabel(selectedMonth)}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconCash size={24} stroke={1.5} />}
          title="Nenhuma proposta registrada"
          description={
            hasActiveFilters
              ? 'Nenhuma proposta encontrada para esse filtro. Tente outro mês ou limpe a busca.'
              : "Propostas cadastradas em 'Nova proposta' aparecem aqui, com a comissão do vendedor calculada."
          }
        />
      ) : (
        <div className="space-y-8">
          {grupos.map((grupo) => (
            <div key={grupo.key} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-neutral-700">
                  {grupo.label}
                </h2>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span>
                    {grupo.items.length} proposta{grupo.items.length === 1 ? '' : 's'}
                  </span>
                  <span className="font-bold text-liberty-deep">
                    Comissão: {formatCurrency(grupo.comissaoTotal)}
                  </span>
                </div>
              </div>

              {grupo.items.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 border-b border-neutral-100 pb-4 mb-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-neutral-450">
                        Registrada em {formatDate(p.created_at)}
                        {p.vendedor_email ? ` · por ${p.vendedor_email}` : ''}
                      </span>
                      <h3 className="mt-1 text-base font-bold text-neutral-900">{p.nome}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-neutral-600">
                        {p.email && (
                          <span className="inline-flex items-center gap-1">
                            <IconMail size={13} className="text-neutral-400" />
                            {p.email}
                          </span>
                        )}
                        {p.telefone && (
                          <span className="inline-flex items-center gap-1 font-semibold text-neutral-800">
                            <IconPhone size={13} className="text-neutral-400" />
                            {p.telefone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${STATUS_TONE[p.status]}`}
                      >
                        {p.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(p)}
                        disabled={downloadingId === p.id}
                        aria-label="Baixar PDF novamente"
                        className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer disabled:opacity-50"
                      >
                        {downloadingId === p.id ? (
                          <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                        ) : (
                          <IconDownload size={14} stroke={2.5} />
                        )}
                      </button>
                      <Link
                        href={`/dashboard/propostas/registros/${p.id}/editar`}
                        aria-label="Editar proposta"
                        className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
                      >
                        <IconPencil size={14} stroke={2.5} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(p.id)}
                        disabled={deletingId === p.id}
                        aria-label="Excluir proposta"
                        className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-ui cursor-pointer disabled:opacity-50"
                      >
                        <IconTrash size={14} stroke={2.5} />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                      <span className="block text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                        Veículo
                      </span>
                      <h4 className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-neutral-900">
                        <IconCar size={14} className="text-neutral-400" />
                        {p.veiculo_marca} {p.veiculo_modelo}
                      </h4>
                    </div>

                    <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                      <span className="block text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                        Proposta prévia
                      </span>
                      <p className="mt-1.5 text-sm font-bold text-neutral-900">
                        {p.proposta_previa != null ? formatCurrency(p.proposta_previa) : '—'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                      <span className="block text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                        Valor da proposta
                      </span>
                      <p className="mt-1.5 text-sm font-bold text-neutral-900">
                        {p.valor != null ? formatCurrency(p.valor) : '—'}
                      </p>
                    </div>

                    {/* Comissão em destaque */}
                    <div className="rounded-xl border border-liberty/30 bg-liberty/10 p-4">
                      <span className="block text-[9px] font-bold uppercase tracking-widest text-liberty-deep/70">
                        Comissão do vendedor
                      </span>
                      <p className="mt-1.5 text-lg font-black text-liberty-deep">
                        {p.comissao_vendedor != null ? formatCurrency(p.comissao_vendedor) : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId != null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        title="Excluir proposta registrada"
        description="Essa ação não pode ser desfeita. A proposta será removida permanentemente."
        confirmLabel="Excluir"
        tone="danger"
        loading={deletingId != null}
      />
    </div>
  )
}
