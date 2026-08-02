'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  IconArrowLeft,
  IconCar,
  IconCash,
  IconMail,
  IconPhone,
  IconPlus,
  IconTrash,
  IconSearch,
  IconWallet,
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

export default function PropostasRegistradasClient({ propostas }: PropostasRegistradasClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [searchNome, setSearchNome] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = searchNome.trim().toLowerCase()
    if (!q) return propostas
    return propostas.filter((p) => p.nome.toLowerCase().includes(q))
  }, [propostas, searchNome])

  const comissaoTotal = useMemo(
    () => filtered.reduce((acc, p) => acc + (p.comissao_vendedor ?? 0), 0),
    [filtered],
  )

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
                Comissão total {searchNome.trim() ? '(filtrada)' : ''}
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

      {/* Busca */}
      <div className="relative max-w-sm">
        <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={searchNome}
          onChange={(e) => setSearchNome(e.target.value)}
          placeholder="Buscar por cliente..."
          className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconCash size={24} stroke={1.5} />}
          title="Nenhuma proposta registrada"
          description="Propostas cadastradas em 'Nova proposta' aparecem aqui, com a comissão do vendedor calculada."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((p) => (
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

                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${STATUS_TONE[p.status]}`}
                  >
                    {p.status}
                  </span>
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
