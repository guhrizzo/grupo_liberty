'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  IconPlus,
  IconBug,
  IconBulb,
  IconX,
  IconChevronDown,
  IconTrash,
  IconMessagePlus,
  IconUser,
  IconClock,
  IconSend,
} from '@tabler/icons-react'
import { Breadcrumb, Button, ConfirmDialog, Input, Textarea, EmptyState, useToast } from '@/app/components/ui'
import { formatDate, formatDateTime } from '@/utils/format'
import {
  FEEDBACK_STATUS,
  FEEDBACK_STATUS_ORDEM,
  FEEDBACK_TIPOS,
  type FeedbackStatus,
  type FeedbackTipo,
} from '@/constants/feedback'
import type { Feedback } from './types'
import {
  criarFeedback,
  atualizarStatusFeedback,
  adicionarAtualizacaoFeedback,
  deletarFeedback,
} from './actions'

interface FeedbackClientProps {
  itens: Feedback[]
  isOwner: boolean
}

function TipoBadge({ tipo }: { tipo: FeedbackTipo }) {
  const meta = FEEDBACK_TIPOS[tipo]
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ' +
        meta.classes
      }
    >
      {tipo === 'bug' ? <IconBug size={11} stroke={2.5} /> : <IconBulb size={11} stroke={2.5} />}
      {meta.label}
    </span>
  )
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const meta = FEEDBACK_STATUS[status]
  return (
    <span
      className={
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ' +
        meta.classes
      }
    >
      {meta.label}
    </span>
  )
}

export default function FeedbackClient({ itens, isOwner }: FeedbackClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [isPending, startTransition] = useTransition()

  const [showModal, setShowModal] = useState(false)
  const [loadingForm, setLoadingForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [filtroTipo, setFiltroTipo] = useState<'todos' | FeedbackTipo>('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | FeedbackStatus>('todos')

  const contagem = useMemo(() => {
    const c = { total: itens.length, aberto: 0, em_analise: 0, resolvido: 0, descartado: 0 }
    for (const it of itens) c[it.status]++
    return c
  }, [itens])

  const filtrados = useMemo(() => {
    return itens.filter((it) => {
      if (filtroTipo !== 'todos' && it.tipo !== filtroTipo) return false
      if (filtroStatus !== 'todos' && it.status !== filtroStatus) return false
      return true
    })
  }, [itens, filtroTipo, filtroStatus])

  const filtrosAtivos = filtroTipo !== 'todos' || filtroStatus !== 'todos'

  const handleCriar = useCallback(
    async (fd: FormData) => {
      setLoadingForm(true)
      try {
        const result = await criarFeedback(fd)
        if (result.error && !result.fieldErrors) {
          toast.error(result.error)
        }
        if (result.fieldErrors) {
          return result.fieldErrors
        }
        if (result.success) {
          toast.success(result.success)
          setShowModal(false)
          router.refresh()
        }
      } finally {
        setLoadingForm(false)
      }
      return undefined
    },
    [router, toast],
  )

  const handleStatus = useCallback(
    (id: string, status: FeedbackStatus) => {
      startTransition(async () => {
        const result = await atualizarStatusFeedback(id, status)
        if (result.error) toast.error(result.error)
        else {
          toast.success(result.success || 'Status atualizado.')
          router.refresh()
        }
      })
    },
    [router, toast],
  )

  const handleAtualizacao = useCallback(
    (id: string, texto: string, onDone: () => void) => {
      startTransition(async () => {
        const result = await adicionarAtualizacaoFeedback(id, texto)
        if (result.error) toast.error(result.error)
        else {
          toast.success(result.success || 'Atualização adicionada.')
          onDone()
          router.refresh()
        }
      })
    },
    [router, toast],
  )

  const handleDelete = useCallback(() => {
    if (!deleteId) return
    startTransition(async () => {
      const result = await deletarFeedback(deleteId)
      if (result.error) toast.error(result.error)
      else {
        toast.success(result.success || 'Report removido.')
        router.refresh()
      }
      setDeleteId(null)
    })
  }, [deleteId, router, toast])

  return (
    <div className="space-y-5 pb-28 md:space-y-6 md:pb-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="hidden md:block">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Bugs & Melhorias' }]} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-950 md:mt-1 md:text-3xl">
            Bugs &amp; Melhorias
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 md:mt-1 md:text-sm">
            Reporte um problema ou sugira uma melhoria no sistema.
          </p>
        </div>
        <Button
          variant="liberty"
          leftIcon={<IconPlus size={16} stroke={2.5} />}
          onClick={() => setShowModal(true)}
        >
          Novo report
        </Button>
      </header>

      <section aria-label="Resumo" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            { label: 'Total', value: contagem.total },
            { label: 'Abertos', value: contagem.aberto },
            { label: 'Em análise', value: contagem.em_analise },
            { label: 'Resolvidos', value: contagem.resolvido },
          ] as const
        ).map((k) => (
          <div key={k.label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">{k.label}</p>
            <p className="mt-1 text-2xl font-bold text-neutral-950 tabular-nums">{k.value}</p>
          </div>
        ))}
      </section>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-neutral-200 bg-white p-1">
          {(
            [
              { id: 'todos', label: 'Todos' },
              { id: 'bug', label: 'Bugs' },
              { id: 'melhoria', label: 'Melhorias' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFiltroTipo(opt.id as 'todos' | FeedbackTipo)}
              className={
                'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ' +
                (filtroTipo === opt.id ? 'bg-liberty text-white shadow-xs' : 'text-neutral-600 hover:bg-neutral-100')
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-neutral-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setFiltroStatus('todos')}
            className={
              'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ' +
              (filtroStatus === 'todos' ? 'bg-neutral-950 text-white shadow-xs' : 'text-neutral-600 hover:bg-neutral-100')
            }
          >
            Todos
          </button>
          {FEEDBACK_STATUS_ORDEM.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFiltroStatus(s)}
              className={
                'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ' +
                (filtroStatus === s ? 'bg-neutral-950 text-white shadow-xs' : 'text-neutral-600 hover:bg-neutral-100')
              }
            >
              {FEEDBACK_STATUS[s].label}
            </button>
          ))}
        </div>

        {filtrosAtivos && (
          <button
            type="button"
            onClick={() => {
              setFiltroTipo('todos')
              setFiltroStatus('todos')
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-50 transition-ui cursor-pointer"
          >
            <IconX size={12} stroke={2} />
            Limpar
          </button>
        )}
      </div>

      {/* Lista */}
      {itens.length === 0 ? (
        <EmptyState
          icon={<IconBug size={24} stroke={1.5} />}
          title="Nenhum report ainda"
          description="Seja o primeiro a reportar um bug ou sugerir uma melhoria."
          action={
            <Button variant="liberty" size="sm" leftIcon={<IconPlus size={14} stroke={2.5} />} onClick={() => setShowModal(true)}>
              Novo report
            </Button>
          }
        />
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm font-semibold text-neutral-500">
          Nenhum report com esses filtros.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtrados.map((it) => (
            <FeedbackCard
              key={it.id}
              item={it}
              isOwner={isOwner}
              expanded={expandedId === it.id}
              onToggle={() => setExpandedId((c) => (c === it.id ? null : it.id))}
              busy={isPending}
              onStatus={handleStatus}
              onAtualizacao={handleAtualizacao}
              onRequestDelete={() => setDeleteId(it.id)}
            />
          ))}
        </ul>
      )}

      {showModal && (
        <NovoReportModal
          loading={loadingForm}
          onClose={() => !loadingForm && setShowModal(false)}
          onSubmit={handleCriar}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Remover report?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        tone="danger"
        loading={isPending}
      />
    </div>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────

function FeedbackCard({
  item,
  isOwner,
  expanded,
  onToggle,
  busy,
  onStatus,
  onAtualizacao,
  onRequestDelete,
}: {
  item: Feedback
  isOwner: boolean
  expanded: boolean
  onToggle: () => void
  busy: boolean
  onStatus: (id: string, status: FeedbackStatus) => void
  onAtualizacao: (id: string, texto: string, onDone: () => void) => void
  onRequestDelete: () => void
}) {
  const [nota, setNota] = useState('')

  return (
    <li className="rounded-2xl border border-neutral-200 bg-white shadow-xs">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-4 text-left cursor-pointer"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <TipoBadge tipo={item.tipo} />
            <StatusBadge status={item.status} />
          </div>
          <p className="mt-2 text-sm font-bold text-neutral-950">{item.titulo}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1">
              <IconUser size={11} stroke={2} />
              {item.criadoPorNome}
            </span>
            <span className="inline-flex items-center gap-1">
              <IconClock size={11} stroke={2} />
              {formatDate(item.criadoEm)}
            </span>
            {item.atualizacoes.length > 0 && (
              <span className="inline-flex items-center gap-1 text-neutral-400">
                · {item.atualizacoes.length} atualização{item.atualizacoes.length === 1 ? '' : 'ões'}
              </span>
            )}
          </p>
        </div>
        <IconChevronDown
          size={16}
          stroke={2.5}
          className={`mt-1 shrink-0 text-neutral-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-neutral-100 px-4 py-4 space-y-4">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700">{item.descricao}</p>

          {item.tela && (
            <p className="text-[11px] text-neutral-500">
              <span className="font-bold uppercase tracking-wider">Onde:</span> {item.tela}
            </p>
          )}

          {item.atualizacoes.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
                Atualizações
              </p>
              <ul className="space-y-2 border-l-2 border-neutral-100 pl-3">
                {item.atualizacoes.map((a, i) => (
                  <li key={i} className="text-[13px] text-neutral-700">
                    <p className="whitespace-pre-wrap">{a.texto}</p>
                    <p className="mt-0.5 text-[10px] font-medium text-neutral-400">{formatDateTime(a.em)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isOwner && (
            <div className="space-y-3 rounded-xl border border-liberty/20 bg-liberty/5 p-3">
              <div>
                <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-liberty-deep">
                  Status
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FEEDBACK_STATUS_ORDEM.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy || s === item.status}
                      onClick={() => onStatus(item.id, s)}
                      className={
                        'rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer disabled:cursor-default ' +
                        (s === item.status
                          ? FEEDBACK_STATUS[s].classes
                          : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-50')
                      }
                    >
                      {FEEDBACK_STATUS[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Textarea
                  label="Adicionar atualização"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ex: reproduzi o bug; corrigido no deploy de hoje…"
                  rows={2}
                  maxLength={2000}
                />
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={onRequestDelete}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-ui cursor-pointer disabled:opacity-50"
                  >
                    <IconTrash size={13} stroke={2} />
                    Excluir report
                  </button>
                  <Button
                    variant="liberty"
                    size="sm"
                    leftIcon={<IconMessagePlus size={14} stroke={2} />}
                    loading={busy}
                    disabled={!nota.trim()}
                    onClick={() => onAtualizacao(item.id, nota.trim(), () => setNota(''))}
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

// ─── Modal Novo Report ───────────────────────────────────────────────────────

function NovoReportModal({
  loading,
  onClose,
  onSubmit,
}: {
  loading: boolean
  onClose: () => void
  onSubmit: (fd: FormData) => Promise<Record<string, string> | undefined>
}) {
  const [tipo, setTipo] = useState<FeedbackTipo>('bug')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tela, setTela] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (typeof document === 'undefined') return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('tipo', tipo)
    fd.append('titulo', titulo)
    fd.append('descricao', descricao)
    fd.append('tela', tela)
    const fieldErrors = await onSubmit(fd)
    setErrors(fieldErrors ?? {})
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
          <div>
            <h2 className="text-base font-bold text-neutral-950">Novo report</h2>
            <p className="mt-0.5 text-xs text-neutral-600">Um bug ou uma sugestão de melhoria.</p>
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
          <div className="grid grid-cols-2 gap-2">
            {(['bug', 'melhoria'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                aria-pressed={tipo === t}
                className={
                  'inline-flex items-center justify-center gap-1.5 rounded-xl border-2 py-3 text-xs font-bold transition-all cursor-pointer ' +
                  (tipo === t
                    ? 'border-liberty bg-liberty text-white shadow-sm'
                    : 'border-neutral-200 bg-white text-neutral-500 hover:border-liberty/40')
                }
              >
                {t === 'bug' ? <IconBug size={14} stroke={2.5} /> : <IconBulb size={14} stroke={2.5} />}
                {FEEDBACK_TIPOS[t].label}
              </button>
            ))}
          </div>

          <Input
            id="fbTitulo"
            label="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={tipo === 'bug' ? 'Ex: erro ao salvar cobrança' : 'Ex: filtro por data no financeiro'}
            maxLength={140}
            error={errors.titulo}
            required
            autoFocus
          />

          <Textarea
            id="fbDescricao"
            label="Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={
              tipo === 'bug'
                ? 'O que aconteceu, o que você esperava, e como reproduzir.'
                : 'O que melhoraria e por quê.'
            }
            rows={4}
            maxLength={4000}
            error={errors.descricao}
          />

          <Input
            id="fbTela"
            label="Onde aconteceu (opcional)"
            value={tela}
            onChange={(e) => setTela(e.target.value)}
            placeholder="Ex: Cobranças, ao registrar pagamento"
            maxLength={140}
            error={errors.tela}
          />
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
                Enviando...
              </>
            ) : (
              <>
                <IconSend size={14} stroke={2.5} />
                Enviar report
              </>
            )}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
