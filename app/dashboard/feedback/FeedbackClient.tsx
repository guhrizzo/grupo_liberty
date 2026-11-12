'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  IconPlus,
  IconBug,
  IconBulb,
  IconX,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconTrash,
  IconMessagePlus,
  IconUser,
  IconClock,
  IconSend,
  IconPhoto,
  IconSearch,
} from '@tabler/icons-react'
import { casaBusca } from '@/utils/busca'
import { Breadcrumb, Button, ConfirmDialog, Input, Textarea, EmptyState, useToast } from '@/app/components/ui'
import { formatDate, formatDateTime } from '@/utils/format'
import {
  FEEDBACK_STATUS,
  FEEDBACK_STATUS_ORDEM,
  FEEDBACK_TIPOS,
  FEEDBACK_MAX_FOTOS,
  type FeedbackStatus,
  type FeedbackTipo,
} from '@/constants/feedback'
import type { Feedback } from './types'
import {
  criarFeedback,
  atualizarStatusFeedback,
  adicionarAtualizacaoFeedback,
  deletarAtualizacaoFeedback,
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

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** "YYYY-MM" do report, no fuso de Brasília (igual no servidor e no navegador). */
function mesDoReport(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'sem-data'
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)
}

function rotuloMes(chave: string): string {
  if (chave === 'sem-data') return 'Sem data'
  const [ano, mes] = chave.split('-')
  return `${MESES[Number(mes) - 1] ?? mes} de ${ano}`
}

/** Soma `delta` meses a uma chave "YYYY-MM". */
function somarMeses(chave: string, delta: number): string {
  const [ano, mes] = chave.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Ainda não foi feito: segue aparecendo nos meses seguintes. */
function estaPendente(status: FeedbackStatus): boolean {
  return status === 'aberto' || status === 'em_analise'
}

interface ContagemStatus {
  aberto: number
  em_analise: number
  resolvido: number
  descartado: number
}

/** Barra de andamento: feito (resolvido) × em análise × ainda não feito. Descartados ficam de fora. */
function ProgressoBarra({ c, titulo }: { c: ContagemStatus; titulo?: string }) {
  const total = c.aberto + c.em_analise + c.resolvido
  const pct = total > 0 ? Math.round((c.resolvido / total) * 100) : 0
  const w = (n: number) => (total > 0 ? `${(n / total) * 100}%` : '0%')
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
          {titulo ?? 'Andamento'}
        </p>
        <p className="text-sm font-bold tabular-nums text-neutral-950">
          {pct}% <span className="text-[11px] font-medium text-neutral-500">feito</span>
        </p>
      </div>
      <div
        className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-neutral-200/70"
        role="img"
        aria-label={`${pct}% feito: ${c.resolvido} resolvidos, ${c.em_analise} em análise, ${c.aberto} abertos`}
      >
        <div className="h-full bg-emerald-500 transition-[width] duration-700" style={{ width: w(c.resolvido) }} />
        <div className="h-full bg-sky-500 transition-[width] duration-700" style={{ width: w(c.em_analise) }} />
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-500">
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          {c.resolvido} resolvido{c.resolvido === 1 ? '' : 's'}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" />
          {c.em_analise} em análise
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-neutral-400" />
          {c.aberto} não feito{c.aberto === 1 ? '' : 's'}
        </li>
        {c.descartado > 0 && (
          <li className="flex items-center gap-1.5 text-neutral-400">
            <span className="h-2 w-2 shrink-0 rounded-full bg-neutral-300" />
            {c.descartado} descartado{c.descartado === 1 ? '' : 's'}
          </li>
        )}
      </ul>
    </div>
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
  const [deleteAtualizacao, setDeleteAtualizacao] = useState<{ id: string; em: string } | null>(null)

  const [filtroTipo, setFiltroTipo] = useState<'todos' | FeedbackTipo>('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | FeedbackStatus>('todos')
  const [busca, setBusca] = useState('')

  // Calendário: um mês por vez. O que ainda não foi feito (aberto / em análise)
  // continua aparecendo nos meses seguintes até ser resolvido ou descartado.
  const mesAtualChave = useMemo(() => mesDoReport(new Date().toISOString()), [])
  const [mesSel, setMesSel] = useState(mesAtualChave)
  const primeiroMes = useMemo(() => {
    const todos = itens.map((it) => mesDoReport(it.criadoEm)).filter((m) => m !== 'sem-data')
    return todos.length > 0 ? todos.reduce((a, b) => (a < b ? a : b)) : mesAtualChave
  }, [itens, mesAtualChave])

  const itensDoMes = useMemo(
    () =>
      itens.filter((it) => {
        const criado = mesDoReport(it.criadoEm)
        return criado === mesSel || (criado < mesSel && estaPendente(it.status))
      }),
    [itens, mesSel],
  )

  const statsDoMes = useMemo(() => {
    const c: ContagemStatus = { aberto: 0, em_analise: 0, resolvido: 0, descartado: 0 }
    for (const it of itensDoMes) c[it.status]++
    return c
  }, [itensDoMes])

  const termoBusca = busca.trim()

  // Com texto na busca, procura em todos os meses (não só no mês selecionado).
  const filtrados = useMemo(() => {
    return (termoBusca ? itens : itensDoMes).filter((it) => {
      if (filtroTipo !== 'todos' && it.tipo !== filtroTipo) return false
      if (filtroStatus !== 'todos' && it.status !== filtroStatus) return false
      if (
        termoBusca &&
        !casaBusca(termoBusca, [
          it.titulo,
          it.descricao,
          it.tela,
          it.criadoPorNome,
          it.tipo === 'bug' ? 'bug' : 'melhoria',
          ...it.atualizacoes.map((a) => a.texto),
        ])
      ) {
        return false
      }
      return true
    })
  }, [itens, itensDoMes, termoBusca, filtroTipo, filtroStatus])

  const filtrosAtivos = filtroTipo !== 'todos' || filtroStatus !== 'todos' || !!termoBusca

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
    (id: string, texto: string, fotos: File[], onDone: () => void) => {
      startTransition(async () => {
        const fd = new FormData()
        fd.append('id', id)
        fd.append('texto', texto)
        fotos.forEach((f) => fd.append('fotos', f))
        const result = await adicionarAtualizacaoFeedback(fd)
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

  const handleDeleteAtualizacao = useCallback(() => {
    if (!deleteAtualizacao) return
    startTransition(async () => {
      const result = await deletarAtualizacaoFeedback(deleteAtualizacao.id, deleteAtualizacao.em)
      if (result.error) toast.error(result.error)
      else {
        toast.success(result.success || 'Atualização removida.')
        router.refresh()
      }
      setDeleteAtualizacao(null)
    })
  }, [deleteAtualizacao, router, toast])

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

      {/* Resumo do mês selecionado, dividido em células */}
      <section
        aria-label={`Resumo de ${rotuloMes(mesSel)}`}
        className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Mês anterior"
              disabled={mesSel <= primeiroMes}
              onClick={() => setMesSel((m) => somarMeses(m, -1))}
              className="rounded-lg border border-neutral-200 bg-white p-1.5 text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              <IconChevronLeft size={16} />
            </button>
            <h2 className="min-w-40 px-2 text-center text-base font-bold text-neutral-950">
              {rotuloMes(mesSel)}
            </h2>
            <button
              type="button"
              aria-label="Próximo mês"
              disabled={mesSel >= mesAtualChave}
              onClick={() => setMesSel((m) => somarMeses(m, 1))}
              className="rounded-lg border border-neutral-200 bg-white p-1.5 text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              <IconChevronRight size={16} />
            </button>
          </div>
          {mesSel !== mesAtualChave && (
            <button
              type="button"
              onClick={() => setMesSel(mesAtualChave)}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
            >
              Mês atual
            </button>
          )}
        </div>
        <div className="mt-px grid grid-cols-2 gap-px lg:grid-cols-4">
          {(
            [
              { label: 'Total', value: itensDoMes.length },
              { label: 'Abertos', value: statsDoMes.aberto },
              { label: 'Em análise', value: statsDoMes.em_analise },
              { label: 'Resolvidos', value: statsDoMes.resolvido },
            ] as const
          ).map((k) => (
            <div key={k.label} className="bg-white p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">{k.label}</p>
              <p className="mt-1 text-2xl font-bold text-neutral-950 tabular-nums">{k.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-px bg-white p-4">
          <ProgressoBarra c={statsDoMes} titulo="Andamento do mês" />
        </div>
      </section>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          aria-label="Pesquisar reports"
          placeholder="Pesquisar bugs e melhorias"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          leftIcon={<IconSearch size={14} />}
          containerClassName="w-full sm:w-72"
        />
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
      ) : (
        <section aria-label={rotuloMes(mesSel)} className="space-y-3">
          {filtrados.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm font-semibold text-neutral-500">
              {filtrosAtivos ? 'Nenhum report com esses filtros neste mês.' : 'Nenhum report neste mês.'}
            </div>
          ) : (
            <ul className="space-y-3">
              {filtrados.map((it) => {
                const criado = mesDoReport(it.criadoEm)
                return (
                  <FeedbackCard
                    key={it.id}
                    item={it}
                    carregadoDe={criado !== mesSel ? rotuloMes(criado) : undefined}
                    isOwner={isOwner}
                    expanded={expandedId === it.id}
                    onToggle={() => setExpandedId((c) => (c === it.id ? null : it.id))}
                    busy={isPending}
                    onStatus={handleStatus}
                    onAtualizacao={handleAtualizacao}
                    onRequestDelete={() => setDeleteId(it.id)}
                    onRequestDeleteAtualizacao={(em) => setDeleteAtualizacao({ id: it.id, em })}
                  />
                )
              })}
            </ul>
          )}
        </section>
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

      <ConfirmDialog
        open={!!deleteAtualizacao}
        onClose={() => setDeleteAtualizacao(null)}
        onConfirm={handleDeleteAtualizacao}
        title="Remover atualização?"
        description="O comentário (e as fotos dele) será apagado. Esta ação não pode ser desfeita."
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
  carregadoDe,
  isOwner,
  expanded,
  onToggle,
  busy,
  onStatus,
  onAtualizacao,
  onRequestDelete,
  onRequestDeleteAtualizacao,
}: {
  item: Feedback
  /** Mês em que foi aberto, quando está sendo mostrado num mês posterior. */
  carregadoDe?: string
  isOwner: boolean
  expanded: boolean
  onToggle: () => void
  busy: boolean
  onStatus: (id: string, status: FeedbackStatus) => void
  onAtualizacao: (id: string, texto: string, fotos: File[], onDone: () => void) => void
  onRequestDelete: () => void
  onRequestDeleteAtualizacao: (em: string) => void
}) {
  const [nota, setNota] = useState('')
  const [notaErro, setNotaErro] = useState<string | null>(null)
  const [notaFotos, setNotaFotos] = useState<File[]>([])
  const notaPreviews = useMemo(() => notaFotos.map((f) => URL.createObjectURL(f)), [notaFotos])
  useEffect(() => () => notaPreviews.forEach((u) => URL.revokeObjectURL(u)), [notaPreviews])

  function anexarFotos(lista: FileList | null) {
    if (!lista) return
    const imagens = Array.from(lista).filter((f) => f.type.startsWith('image/'))
    setNotaFotos((atual) => [...atual, ...imagens].slice(0, FEEDBACK_MAX_FOTOS))
  }

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
            {carregadoDe && (
              <span className="inline-flex items-center rounded-full border border-neutral-200 px-2.5 py-0.5 text-[10px] font-semibold text-neutral-500">
                Pendente desde {carregadoDe}
              </span>
            )}
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

          {item.fotos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.fotos.map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir foto ${i + 1} em tamanho real`}
                  className="block overflow-hidden rounded-lg border border-neutral-200 transition-opacity hover:opacity-80"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Foto ${i + 1} do report`} className="h-24 w-24 object-cover" />
                </a>
              ))}
            </div>
          )}

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
                    {a.texto && <p className="whitespace-pre-wrap">{a.texto}</p>}
                    {a.fotos.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {a.fotos.map((url, j) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Abrir foto ${j + 1} da atualização em tamanho real`}
                            className="block overflow-hidden rounded-lg border border-neutral-200 transition-opacity hover:opacity-80"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`Foto ${j + 1} da atualização`} className="h-24 w-24 object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="text-[10px] font-medium text-neutral-400">{formatDateTime(a.em)}</p>
                      {isOwner && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onRequestDeleteAtualizacao(a.em)}
                          aria-label="Excluir atualização"
                          title="Excluir atualização"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer disabled:opacity-50"
                        >
                          <IconTrash size={11} stroke={2} />
                          Excluir
                        </button>
                      )}
                    </div>
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
                {notaPreviews.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {notaPreviews.map((src, i) => (
                      <div key={src} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`Foto ${i + 1}`} className="h-16 w-16 rounded-lg border border-neutral-200 object-cover" />
                        <button
                          type="button"
                          onClick={() => setNotaFotos((atual) => atual.filter((_, j) => j !== i))}
                          aria-label={`Remover foto ${i + 1}`}
                          className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-white shadow cursor-pointer"
                        >
                          <IconX size={12} stroke={3} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {notaFotos.length < FEEDBACK_MAX_FOTOS && (
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition-ui">
                    <IconPhoto size={14} stroke={2.2} />
                    Adicionar foto ({notaFotos.length}/{FEEDBACK_MAX_FOTOS})
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        anexarFotos(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
                {notaErro && <p className="mt-1.5 text-xs font-semibold text-rose-600">{notaErro}</p>}
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
                    disabled={!nota.trim() && notaFotos.length === 0}
                    onClick={() => {
                      if (notaFotos.reduce((t, f) => t + f.size, 0) > 9 * 1024 * 1024) {
                        setNotaErro('As fotos somam mais de 9 MB. Remova alguma ou use imagens menores.')
                        return
                      }
                      setNotaErro(null)
                      onAtualizacao(item.id, nota.trim(), notaFotos, () => {
                        setNota('')
                        setNotaFotos([])
                      })
                    }}
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
  const [fotos, setFotos] = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const previews = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  function adicionarFotos(lista: FileList | null) {
    if (!lista) return
    const imagens = Array.from(lista).filter((f) => f.type.startsWith('image/'))
    setFotos((atual) => [...atual, ...imagens].slice(0, FEEDBACK_MAX_FOTOS))
  }

  if (typeof document === 'undefined') return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (fotos.reduce((t, f) => t + f.size, 0) > 9 * 1024 * 1024) {
      setErrors({ fotos: 'As fotos somam mais de 9 MB. Remova alguma ou use imagens menores.' })
      return
    }
    const fd = new FormData()
    fd.append('tipo', tipo)
    fd.append('titulo', titulo)
    fd.append('descricao', descricao)
    fd.append('tela', tela)
    fotos.forEach((f) => fd.append('fotos', f))
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

          <div>
            <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
              Fotos (opcional)
            </span>
            {previews.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {previews.map((src, i) => (
                  <div key={src} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Foto ${i + 1}`} className="h-16 w-16 rounded-lg border border-neutral-200 object-cover" />
                    <button
                      type="button"
                      onClick={() => setFotos((atual) => atual.filter((_, j) => j !== i))}
                      aria-label={`Remover foto ${i + 1}`}
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-white shadow cursor-pointer"
                    >
                      <IconX size={12} stroke={3} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {fotos.length < FEEDBACK_MAX_FOTOS && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition-ui">
                <IconPhoto size={14} stroke={2.2} />
                Adicionar foto ({fotos.length}/{FEEDBACK_MAX_FOTOS})
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    adicionarFotos(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
            {errors.fotos && <p className="mt-1.5 text-xs font-semibold text-rose-600">{errors.fotos}</p>}
          </div>
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
