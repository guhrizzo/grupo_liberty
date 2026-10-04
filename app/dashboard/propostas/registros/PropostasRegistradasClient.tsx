'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  IconCalendar,
  IconCar,
  IconCash,
  IconChevronDown,
  IconCircleCheck,
  IconDownload,
  IconMail,
  IconPencil,
  IconPhone,
  IconPlus,
  IconTrash,
  IconSearch,
  IconWallet,
  IconWorld,
  IconX,
} from '@tabler/icons-react'
import {
  definirPropostaFechada,
  definirPropostaRecusada,
  deletePropostaRegistrada,
  type PropostaRegistrada,
} from './actions'
import type { VendedorOpcao } from '@/app/dashboard/metas/types'
import { Breadcrumb, Button, EmptyState, ConfirmDialog, Modal, Select, useToast } from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'

interface PropostasRegistradasClientProps {
  propostas: PropostaRegistrada[]
  vendedores: VendedorOpcao[]
  /** Propostas do site aguardando resposta (contador no botão). */
  propostasSitePendentes?: number
}

type StatusProposta = PropostaRegistrada['status']

const STATUS_PROPOSTA: { valor: StatusProposta; label: string; ativo: string; selo: string }[] = [
  { valor: 'pendente', label: 'Em aberto', ativo: 'bg-amber-500 text-white', selo: 'bg-amber-100 text-amber-800' },
  { valor: 'recusado', label: 'Recusada', ativo: 'bg-rose-600 text-white', selo: 'bg-rose-100 text-rose-700' },
  { valor: 'aceito', label: 'Aceita', ativo: 'bg-emerald-600 text-white', selo: 'bg-emerald-100 text-emerald-700' },
]

/** Só as aceitas entram na comissão (e nas metas). */
function somaComissaoAceitas(lista: PropostaRegistrada[]) {
  return lista.reduce((acc, p) => acc + (p.status === 'aceito' ? (p.comissao_vendedor ?? 0) : 0), 0)
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

export default function PropostasRegistradasClient({
  propostas,
  vendedores,
  propostasSitePendentes = 0,
}: PropostasRegistradasClientProps) {
  // No celular os cards começam recolhidos; a setinha abre os detalhes.
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set())
  function alternarAberto(id: string) {
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }
  const router = useRouter()
  const toast = useToast()
  const [searchNome, setSearchNome] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [fechando, setFechando] = useState<PropostaRegistrada | null>(null)
  const [confirmReabrir, setConfirmReabrir] = useState<PropostaRegistrada | null>(null)
  const [reabrindo, setReabrindo] = useState(false)
  const [confirmRecusar, setConfirmRecusar] = useState<PropostaRegistrada | null>(null)
  const [alterandoId, setAlterandoId] = useState<string | null>(null)
  const [statusFiltro, setStatusFiltro] = useState<StatusProposta | ''>('')

  const hasActiveFilters = Boolean(searchNome.trim() || selectedMonth || statusFiltro)

  const filtered = useMemo(() => {
    const q = searchNome.trim().toLowerCase()
    return propostas.filter((p) => {
      if (q && !p.nome.toLowerCase().includes(q)) return false
      if (selectedMonth && mesKey(p.created_at) !== selectedMonth) return false
      if (statusFiltro && p.status !== statusFiltro) return false
      return true
    })
  }, [propostas, searchNome, selectedMonth, statusFiltro])

  const comissaoTotal = useMemo(() => somaComissaoAceitas(filtered), [filtered])
  const aceitasCount = filtered.filter((p) => p.status === 'aceito').length

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
        comissaoTotal: somaComissaoAceitas(items),
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

  const recusar = async (p: PropostaRegistrada) => {
    setAlterandoId(p.id)
    try {
      const res = await definirPropostaRecusada(p.id)
      if (res.error) toast.error(res.error, 'Não foi possível recusar')
      else {
        toast.success(res.success || 'Proposta recusada.')
        router.refresh()
      }
    } finally {
      setAlterandoId(null)
      setConfirmRecusar(null)
    }
  }

  const reabrirDireto = async (p: PropostaRegistrada) => {
    setAlterandoId(p.id)
    try {
      const res = await definirPropostaFechada(p.id, null)
      if (res.error) toast.error(res.error, 'Não foi possível alterar')
      else {
        toast.success(res.success || 'Proposta em aberto.')
        router.refresh()
      }
    } finally {
      setAlterandoId(null)
    }
  }

  const trocarStatus = (p: PropostaRegistrada, novo: StatusProposta) => {
    if (novo === p.status) return
    if (novo === 'aceito') return setFechando(p)
    if (novo === 'pendente') return p.status === 'aceito' ? setConfirmReabrir(p) : void reabrirDireto(p)
    return p.status === 'aceito' ? setConfirmRecusar(p) : void recusar(p)
  }

  const handleReabrir = async (p: PropostaRegistrada) => {
    setReabrindo(true)
    try {
      const res = await definirPropostaFechada(p.id, null)
      if (res.error) {
        toast.error(res.error, 'Não foi possível reabrir')
      } else {
        toast.success(res.success || 'Proposta reaberta.')
        router.refresh()
      }
    } finally {
      setReabrindo(false)
      setConfirmReabrir(null)
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
            { label: 'Propostas' },
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
              href="/dashboard/propostas/site"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
            >
              <IconWorld size={14} stroke={2.5} />
              Propostas de veículos
              {propostasSitePendentes > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {propostasSitePendentes}
                </span>
              )}
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
                Comissão das aceitas {hasActiveFilters ? '(filtrada)' : ''}
              </p>
              <p className="text-2xl font-black leading-tight text-liberty-deep">
                {formatCurrency(comissaoTotal)}
              </p>
            </div>
          </div>
          <p className="text-xs text-neutral-500">
            {filtered.length} proposta{filtered.length === 1 ? '' : 's'} registrada
            {filtered.length === 1 ? '' : 's'} · {aceitasCount} aceita{aceitasCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Busca + filtro por mês */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-auto sm:max-w-sm sm:flex-1">
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
            className="min-w-0 appearance-none rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 focus:border-neutral-950 focus:outline-none transition-colors cursor-pointer"
            aria-label="Filtrar por mês"
          />
        </div>

        <div role="group" aria-label="Filtrar por status" className="inline-flex rounded-lg bg-neutral-100 p-1">
          {[{ valor: '' as const, label: 'Todas' }, ...STATUS_PROPOSTA].map((o) => (
            <button
              key={o.valor || 'todas'}
              type="button"
              onClick={() => setStatusFiltro(o.valor)}
              aria-pressed={statusFiltro === o.valor}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                statusFiltro === o.valor ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {o.label}
            </button>
          ))}
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

              {grupo.items.map((p) => {
                const aberto = abertos.has(p.id)
                return (
                <div
                  key={p.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-md md:p-6"
                >
                  <div
                    className={`flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:border-b md:border-neutral-100 md:pb-4 md:mb-4 ${
                      aberto ? 'border-b border-neutral-100 pb-4 mb-4' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-neutral-450">
                        Registrada em {formatDate(p.created_at)}
                        {p.vendedor_email ? ` · por ${p.vendedor_email}` : ''}
                      </span>
                      <h3 className="mt-1 flex flex-wrap items-center gap-2 text-base font-bold text-neutral-900">
                        {p.nome}
                        {(() => {
                          const cfg = STATUS_PROPOSTA.find((o) => o.valor === p.status) ?? STATUS_PROPOSTA[0]
                          return (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${cfg.selo}`}
                            >
                              {p.status === 'aceito' && <IconCircleCheck size={12} stroke={2.5} />}
                              {cfg.label}
                              {p.status === 'aceito' && p.fechada_por_nome ? ` por ${p.fechada_por_nome}` : ''}
                              {p.status === 'aceito' && p.fechada_em
                                ? ` · ${new Date(p.fechada_em).toLocaleDateString('pt-BR')}`
                                : ''}
                            </span>
                          )
                        })()}
                      </h3>
                      {!aberto && (
                        <p className="mt-1 truncate text-xs text-neutral-600 md:hidden">
                          <span className="font-semibold text-neutral-800">
                            {p.veiculo_marca} {p.veiculo_modelo}
                          </span>
                          {p.comissao_vendedor != null && (
                            <span className="font-bold text-liberty-deep">
                              {' '}· comissão {formatCurrency(p.comissao_vendedor)}
                            </span>
                          )}
                        </p>
                      )}
                      <div
                        className={`mt-1.5 flex-wrap items-center gap-4 text-xs text-neutral-600 md:flex ${
                          aberto ? 'flex' : 'hidden'
                        }`}
                      >
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

                    <button
                      type="button"
                      onClick={() => alternarAberto(p.id)}
                      aria-expanded={aberto}
                      aria-label={aberto ? `Recolher proposta de ${p.nome}` : `Ver detalhes da proposta de ${p.nome}`}
                      className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 cursor-pointer md:hidden"
                    >
                      <IconChevronDown size={18} stroke={2.2} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
                    </button>
                    </div>

                    <div className={`flex-wrap items-center gap-2 md:flex ${aberto ? 'flex' : 'hidden'}`}>
                      <div
                        role="group"
                        aria-label={`Status da proposta de ${p.nome}`}
                        className="grid w-full grid-cols-3 gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1 sm:w-auto"
                      >
                        {STATUS_PROPOSTA.map((o) => (
                          <button
                            key={o.valor}
                            type="button"
                            disabled={alterandoId === p.id}
                            onClick={() => trocarStatus(p, o.valor)}
                            aria-pressed={p.status === o.valor}
                            className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                              p.status === o.valor ? o.ativo : 'text-neutral-600 hover:bg-white'
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
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

                  <div className={`gap-4 sm:grid-cols-2 md:grid lg:grid-cols-4 ${aberto ? 'grid' : 'hidden'}`}>
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
                      <p
                        className={`mt-1.5 text-lg font-black ${
                          p.status === 'aceito' ? 'text-liberty-deep' : 'text-neutral-400 line-through decoration-1'
                        }`}
                      >
                        {p.comissao_vendedor != null ? formatCurrency(p.comissao_vendedor) : '—'}
                      </p>
                      {p.status !== 'aceito' && (
                        <p className="mt-0.5 text-[11px] text-neutral-500">Só conta quando a proposta for aceita.</p>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {fechando && (
        <FecharPropostaModal
          key={fechando.id}
          proposta={fechando}
          vendedores={vendedores}
          onClose={() => setFechando(null)}
          onDone={() => {
            setFechando(null)
            router.refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={confirmReabrir != null}
        onClose={() => !reabrindo && setConfirmReabrir(null)}
        onConfirm={() => confirmReabrir && handleReabrir(confirmReabrir)}
        title="Voltar para em aberto"
        description="A proposta deixa de estar aceita: sai da comissão e da meta do vendedor."
        confirmLabel="Voltar para em aberto"
        loading={reabrindo}
      />

      <ConfirmDialog
        open={confirmRecusar != null}
        onClose={() => alterandoId == null && setConfirmRecusar(null)}
        onConfirm={() => confirmRecusar && recusar(confirmRecusar)}
        title="Marcar como recusada"
        description="A proposta estava aceita: ao recusar, ela sai da comissão e da meta do vendedor."
        confirmLabel="Recusar"
        tone="danger"
        loading={alterandoId != null}
      />

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

// ─── Modal "Quem fechou?" ────────────────────────────────────────────────────

function FecharPropostaModal({
  proposta,
  vendedores,
  onClose,
  onDone,
}: {
  proposta: PropostaRegistrada
  vendedores: VendedorOpcao[]
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  // Já vem preenchido com quem cadastrou, se ele ainda estiver na lista.
  const [vendedorUid, setVendedorUid] = useState(
    vendedores.some((v) => v.uid === proposta.vendedor_uid) ? (proposta.vendedor_uid ?? '') : '',
  )
  const [salvando, setSalvando] = useState(false)

  const opcoes = [
    { value: '', label: 'Selecione o vendedor' },
    ...vendedores.map((v) => ({ value: v.uid, label: v.nome })),
  ]

  async function confirmar() {
    if (!vendedorUid) {
      toast.error('Escolha quem fechou a proposta.')
      return
    }
    setSalvando(true)
    try {
      const res = await definirPropostaFechada(proposta.id, vendedorUid)
      if (res.error) {
        toast.error(res.error, 'Não foi possível aceitar')
        return
      }
      toast.success(res.success || 'Proposta aceita.')
      onDone()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !salvando && onClose()}
      title="Marcar como aceita"
      description={`${proposta.nome} · ${proposta.veiculo_marca} ${proposta.veiculo_modelo}`}
    >
      <div className="mt-4 space-y-4">
        <Select
          label="Quem fechou?"
          hint={
            vendedores.length === 0
              ? 'Nenhum vendedor cadastrado. Peça ao ADM supremo para definir os vendedores na aba Metas.'
              : 'A proposta conta para a meta deste vendedor no mês de hoje.'
          }
          value={vendedorUid}
          onChange={(e) => setVendedorUid(e.target.value)}
          options={opcoes}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" variant="liberty" loading={salvando} onClick={confirmar}>
            Fechar proposta
          </Button>
        </div>
      </div>
    </Modal>
  )
}
