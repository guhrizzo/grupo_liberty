'use client'

import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconAlertTriangle,
  IconCalendarDue,
  IconCheck,
  IconChecklist,
  IconLock,
  IconLockOpen,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUser,
  IconX,
} from '@tabler/icons-react'
import {
  Breadcrumb,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '@/app/components/ui'
import { formatDate, formatDateTime } from '@/utils/format'
import {
  TAREFA_DESCRICAO_MAX,
  AFAZERES_MAX,
  AFAZER_TEXTO_MAX,
  TAREFA_COMENTARIO_MAX,
  TAREFA_STATUS,
  TAREFA_STATUS_ORDEM,
  TAREFA_TITULO_MAX,
  tarefaAtrasada,
  type TarefaStatus,
} from '@/constants/tarefas'
import type { Afazer, Tarefa, TarefaFieldErrors, UsuarioOpcao } from './types'
import {
  definirPedidoExclusao,
  definirTarefaFechada,
  excluirTarefa,
  responderTarefa,
  salvarMeusAfazeres,
  salvarTarefa,
} from './actions'

interface TarefasClientProps {
  tarefas: Tarefa[]
  usuarios: UsuarioOpcao[]
  admSupremo: boolean
  meuUid: string
  /** `YYYY-MM-DD` no fuso do negócio — vem do servidor para não divergir. */
  hoje: string
  /** Lista de afazeres pessoal do usuário logado (privada). */
  afazeres: Afazer[]
}

const CARD =
  'rounded-2xl border border-neutral-200 bg-white shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2'
const CHIP =
  'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer'
const CHIP_OFF =
  'text-neutral-600 hover:bg-neutral-100 adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-3'
const CHIP_GROUP =
  'flex max-w-full items-center gap-1.5 overflow-x-auto rounded-lg border border-neutral-200 bg-white p-1 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2'

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ' +
        className
      }
    >
      {children}
    </span>
  )
}

/** `exclusao` = pedidos de exclusão (abertas e fechadas). */
type FiltroStatus = 'todos' | 'atrasadas' | 'exclusao' | TarefaStatus

export default function TarefasClient({
  tarefas,
  usuarios,
  admSupremo,
  meuUid,
  hoje,
  afazeres,
}: TarefasClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [isPending, startTransition] = useTransition()

  const [verFechadas, setVerFechadas] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  const [filtroResponsavel, setFiltroResponsavel] = useState('')

  const [editando, setEditando] = useState<Tarefa | 'nova' | null>(null)
  const [excluirId, setExcluirId] = useState<string | null>(null)

  const abertas = useMemo(() => tarefas.filter((t) => !t.fechada), [tarefas])
  const fechadas = useMemo(() => tarefas.filter((t) => t.fechada), [tarefas])

  const contagem = useMemo(() => {
    const c = { pendente: 0, atrasadas: 0, concluida: 0, nao_concluida: 0 }
    for (const t of abertas) {
      c[t.status]++
      if (tarefaAtrasada(t, hoje)) c.atrasadas++
    }
    return c
  }, [abertas, hoje])

  const pedidosExclusao = useMemo(() => tarefas.filter((t) => !!t.exclusaoSolicitadaEm).length, [tarefas])

  const filtradas = useMemo(() => {
    // Pedidos de exclusão ignoram a divisão abertas/fechadas: o ADM quer ver todos.
    const base = filtroStatus === 'exclusao' ? tarefas : verFechadas ? fechadas : abertas
    return base.filter((t) => {
      if (filtroResponsavel && t.responsavelUid !== filtroResponsavel) return false
      if (filtroStatus === 'atrasadas') return tarefaAtrasada(t, hoje)
      if (filtroStatus === 'exclusao') return !!t.exclusaoSolicitadaEm
      if (filtroStatus !== 'todos' && t.status !== filtroStatus) return false
      return true
    })
  }, [tarefas, verFechadas, abertas, fechadas, filtroResponsavel, filtroStatus, hoje])

  const filtrosAtivos = filtroStatus !== 'todos' || !!filtroResponsavel

  // ADM supremo vê a lista separada por responsável (ordem alfabética);
  // o usuário comum vê só as dele, sem cabeçalho.
  const grupos = useMemo(() => {
    if (!admSupremo) return [{ uid: null, nome: null, tarefas: filtradas, pendentes: 0, atrasadas: 0 }]
    const porUid = new Map<string, { uid: string; nome: string; tarefas: Tarefa[]; pendentes: number; atrasadas: number }>()
    for (const t of filtradas) {
      let g = porUid.get(t.responsavelUid)
      if (!g) {
        g = { uid: t.responsavelUid, nome: t.responsavelNome, tarefas: [], pendentes: 0, atrasadas: 0 }
        porUid.set(t.responsavelUid, g)
      }
      g.tarefas.push(t)
      if (t.status === 'pendente' && !t.fechada) g.pendentes++
      if (tarefaAtrasada(t, hoje)) g.atrasadas++
    }
    return [...porUid.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [admSupremo, filtradas, hoje])

  const executar = useCallback(
    (acao: () => Promise<{ success?: string; error?: string }>, onOk?: () => void) => {
      startTransition(async () => {
        const result = await acao()
        if (result.error) toast.error(result.error)
        else {
          toast.success(result.success || 'Feito.')
          onOk?.()
          router.refresh()
        }
      })
    },
    [router, toast],
  )

  const handleExcluir = useCallback(() => {
    if (!excluirId) return
    executar(() => excluirTarefa(excluirId), () => setExcluirId(null))
  }, [excluirId, executar])

  return (
    <div className="space-y-5 pb-28 md:space-y-6 md:pb-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="hidden md:block">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Tarefas' }]} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-950 md:mt-1 md:text-3xl adobe-dark:text-adobe-text-hi">
            Tarefas
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 md:mt-1 md:text-sm adobe-dark:text-adobe-text-lo">
            {admSupremo
              ? 'Atribua tarefas com prazo e acompanhe as respostas da equipe.'
              : 'Suas tarefas. Marque como concluída ou explique por que não concluiu.'}
          </p>
        </div>
        {admSupremo && (
          <Button
            variant="liberty"
            leftIcon={<IconPlus size={16} stroke={2.5} />}
            onClick={() => setEditando('nova')}
          >
            Nova tarefa
          </Button>
        )}
      </header>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            { label: 'Pendentes', value: contagem.pendente, cls: '' },
            { label: 'Atrasadas', value: contagem.atrasadas, cls: contagem.atrasadas > 0 ? 'text-rose-600 adobe-dark:text-rose-400' : '' },
            { label: 'Concluídas', value: contagem.concluida, cls: '' },
            { label: 'Não concluídas', value: contagem.nao_concluida, cls: '' },
          ] as const
        ).map((k) => (
          <div key={k.label} className={CARD + ' p-4'}>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 adobe-dark:text-adobe-text-lo">
              {k.label}
            </p>
            <p
              className={
                'mt-1 text-2xl font-bold tabular-nums ' +
                (k.cls || 'text-neutral-950 adobe-dark:text-adobe-text-hi')
              }
            >
              {k.value}
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 md:gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="order-2 min-w-0 space-y-5 md:space-y-6 xl:order-1">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className={CHIP_GROUP}>
              {(
                [
                  { id: false, label: `Abertas (${abertas.length})` },
                  { id: true, label: `Fechadas (${fechadas.length})` },
                ] as const
              ).map((opt) => (
                <button
                  key={String(opt.id)}
                  type="button"
                  onClick={() => setVerFechadas(opt.id)}
                  className={CHIP + ' ' + (verFechadas === opt.id ? 'bg-liberty text-white shadow-xs' : CHIP_OFF)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className={CHIP_GROUP}>
              {(
                [
                  { id: 'todos', label: 'Todos' },
                  ...TAREFA_STATUS_ORDEM.map((s) => ({ id: s, label: TAREFA_STATUS[s].label })),
                  { id: 'atrasadas', label: 'Atrasadas' },
                  ...(admSupremo || pedidosExclusao > 0
                    ? [{ id: 'exclusao', label: `Pedidos de exclusão (${pedidosExclusao})` }]
                    : []),
                ] as { id: FiltroStatus; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFiltroStatus(opt.id)}
                  className={
                    CHIP +
                    ' ' +
                    (filtroStatus === opt.id
                      ? 'bg-neutral-950 text-white shadow-xs adobe-dark:bg-adobe-accent adobe-dark:text-[#0a1720]'
                      : CHIP_OFF)
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {admSupremo && usuarios.length > 0 && (
              <div className="w-full sm:w-60">
                <Select
                  aria-label="Filtrar por responsável"
                  value={filtroResponsavel}
                  onChange={(e) => setFiltroResponsavel(e.target.value)}
                  options={[
                    { value: '', label: 'Todos os responsáveis' },
                    ...usuarios.map((u) => ({ value: u.uid, label: u.nome })),
                  ]}
                />
              </div>
            )}

            {filtrosAtivos && (
              <button
                type="button"
                onClick={() => {
                  setFiltroStatus('todos')
                  setFiltroResponsavel('')
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-50 transition-ui cursor-pointer adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-md"
              >
                <IconX size={12} stroke={2} />
                Limpar
              </button>
            )}
          </div>

          {/* Lista */}
          {tarefas.length === 0 ? (
            <EmptyState
              icon={<IconChecklist size={24} stroke={1.5} />}
              title={admSupremo ? 'Nenhuma tarefa criada' : 'Nenhuma tarefa para você'}
              description={
                admSupremo
                  ? 'Crie uma tarefa, escolha o responsável e defina o prazo.'
                  : 'Quando a administração atribuir uma tarefa a você, ela aparece aqui.'
              }
              action={
                admSupremo ? (
                  <Button
                    variant="liberty"
                    size="sm"
                    leftIcon={<IconPlus size={14} stroke={2.5} />}
                    onClick={() => setEditando('nova')}
                  >
                    Nova tarefa
                  </Button>
                ) : undefined
              }
            />
          ) : filtradas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm font-semibold text-neutral-500 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-lo">
              {verFechadas ? 'Nenhuma tarefa fechada' : 'Nenhuma tarefa aberta'}
              {filtrosAtivos ? ' com esses filtros.' : '.'}
            </div>
          ) : (
            <div className="space-y-6">
              {grupos.map((g) => (
                <section key={g.uid ?? 'todas'} aria-label={g.nome ?? 'Tarefas'} className="space-y-3">
                  {g.nome && (
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-neutral-200 pb-2 adobe-dark:border-adobe-line">
                      <h2 className="inline-flex items-center gap-1.5 text-sm font-bold text-neutral-950 adobe-dark:text-adobe-text-hi">
                        <IconUser size={15} stroke={2} />
                        {g.nome}
                      </h2>
                      <p className="text-[11px] font-semibold text-neutral-500 adobe-dark:text-adobe-text-lo">
                        {g.tarefas.length} {g.tarefas.length === 1 ? 'tarefa' : 'tarefas'}
                        {g.pendentes > 0 && ` · ${g.pendentes} pendente${g.pendentes === 1 ? '' : 's'}`}
                        {g.atrasadas > 0 && (
                          <span className="text-rose-600 adobe-dark:text-rose-400">
                            {` · ${g.atrasadas} atrasada${g.atrasadas === 1 ? '' : 's'}`}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  <ul className="space-y-3">
                    {g.tarefas.map((t) => (
                      <TarefaCard
                        key={t.id}
                        tarefa={t}
                        hoje={hoje}
                        admSupremo={admSupremo}
                        souResponsavel={t.responsavelUid === meuUid}
                        busy={isPending}
                        onResponder={(status, comentario, onOk) =>
                          executar(() => responderTarefa(t.id, status, comentario), onOk)
                        }
                        onEditar={() => setEditando(t)}
                        onFechar={(fechada) => executar(() => definirTarefaFechada(t.id, fechada))}
                        onPedidoExclusao={(pedir) => executar(() => definirPedidoExclusao(t.id, pedir))}
                        onExcluir={() => setExcluirId(t.id)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <aside className="order-1 xl:order-2 xl:sticky xl:top-6">
          <ListaAfazeres inicial={afazeres} />
        </aside>
      </div>

      {admSupremo && (
        <TarefaModal
          // Remonta a cada abertura para reiniciar o formulário.
          key={editando === null ? 'fechado' : editando === 'nova' ? 'nova' : editando.id}
          open={editando !== null}
          tarefa={editando === 'nova' ? null : editando}
          usuarios={usuarios}
          hoje={hoje}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null)
            router.refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={!!excluirId}
        onClose={() => setExcluirId(null)}
        onConfirm={handleExcluir}
        title="Excluir tarefa?"
        description="A tarefa e a resposta do responsável serão apagadas. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        tone="danger"
        loading={isPending}
      />
    </div>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────

function TarefaCard({
  tarefa: t,
  hoje,
  admSupremo,
  souResponsavel,
  busy,
  onResponder,
  onEditar,
  onFechar,
  onExcluir,
  onPedidoExclusao,
}: {
  tarefa: Tarefa
  hoje: string
  admSupremo: boolean
  souResponsavel: boolean
  busy: boolean
  onResponder: (status: TarefaStatus, comentario: string | null, onOk?: () => void) => void
  onEditar: () => void
  onFechar: (fechada: boolean) => void
  onExcluir: () => void
  onPedidoExclusao: (pedir: boolean) => void
}) {
  // Formulário de resposta aberto: 'concluida' (comentário opcional) ou
  // 'nao_concluida' (motivo obrigatório).
  const [respondendo, setRespondendo] = useState<'concluida' | 'nao_concluida' | null>(null)
  const [comentario, setComentario] = useState('')

  function abrirResposta(status: 'concluida' | 'nao_concluida') {
    setComentario(t.status === status ? (t.comentario ?? '') : '')
    setRespondendo(status)
  }
  const atrasada = tarefaAtrasada(t, hoje)
  const podeResponder = souResponsavel && !t.fechada

  return (
    <li className={CARD + ' p-4 space-y-3' + (atrasada ? ' border-rose-300 adobe-dark:border-rose-500/40' : '')}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={TAREFA_STATUS[t.status].classes}>{TAREFA_STATUS[t.status].label}</Badge>
        {atrasada && (
          <Badge className="border-rose-300 bg-rose-600 text-white adobe-dark:border-rose-500/40">
            <IconAlertTriangle size={11} stroke={2.5} />
            Atrasada
          </Badge>
        )}
        {t.exclusaoSolicitadaEm && (
          <Badge className="border-rose-200 bg-rose-50 text-rose-700 adobe-dark:border-rose-500/30 adobe-dark:bg-rose-500/10 adobe-dark:text-rose-300">
            <IconTrash size={11} stroke={2.5} />
            Exclusão solicitada
          </Badge>
        )}
        {t.fechada && (
          <Badge className="border-neutral-200 bg-neutral-100 text-neutral-600 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-3 adobe-dark:text-adobe-text-md">
            <IconLock size={11} stroke={2.5} />
            Fechada
          </Badge>
        )}
      </div>

      <div>
        <p className="text-sm font-bold text-neutral-950 adobe-dark:text-adobe-text-hi">{t.titulo}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-neutral-500 adobe-dark:text-adobe-text-lo">
          <span
            className={
              'inline-flex items-center gap-1 ' +
              (atrasada ? 'font-bold text-rose-600 adobe-dark:text-rose-400' : '')
            }
          >
            <IconCalendarDue size={12} stroke={2} />
            Prazo: {formatDate(t.prazo)}
          </span>
          {!admSupremo && <span>Criada por {t.criadoPorNome}</span>}
        </p>
      </div>

      {t.descricao && (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700 adobe-dark:text-adobe-text-md">
          {t.descricao}
        </p>
      )}

      {t.status !== 'pendente' && (
        <div
          className={
            'rounded-xl border p-3 text-[13px] ' +
            (t.status === 'concluida'
              ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800 adobe-dark:border-emerald-500/30 adobe-dark:bg-emerald-500/10 adobe-dark:text-emerald-200'
              : 'border-rose-200 bg-rose-50/60 text-rose-800 adobe-dark:border-rose-500/30 adobe-dark:bg-rose-500/10 adobe-dark:text-rose-200')
          }
        >
          <p className="font-bold">
            {t.status === 'concluida' ? 'Marcada como concluída' : 'Não concluída'}
            {t.respondidoEm && (
              <span className="font-medium opacity-70"> · {formatDateTime(t.respondidoEm)}</span>
            )}
          </p>
          {t.comentario && (
            <p className="mt-1 whitespace-pre-wrap">
              {t.status === 'concluida' ? 'Comentário' : 'Motivo'}: {t.comentario}
            </p>
          )}
        </div>
      )}

      {podeResponder && (
        <div className="space-y-2">
          {respondendo ? (
            <div className="space-y-2">
              <Textarea
                label={respondendo === 'concluida' ? 'Comentário (opcional)' : 'Por que não concluiu?'}
                placeholder={respondendo === 'concluida' ? 'Ex: cliente confirmou a visita para sexta.' : undefined}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
                maxLength={TAREFA_COMENTARIO_MAX}
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={respondendo === 'concluida' ? 'liberty' : 'danger'}
                  size="sm"
                  leftIcon={
                    respondendo === 'concluida' ? <IconCheck size={14} stroke={2.5} /> : undefined
                  }
                  loading={busy}
                  disabled={respondendo === 'nao_concluida' && !comentario.trim()}
                  onClick={() => onResponder(respondendo, comentario, () => setRespondendo(null))}
                >
                  {respondendo === 'concluida' ? 'Confirmar conclusão' : 'Enviar motivo'}
                </Button>
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => setRespondendo(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={t.status === 'concluida' ? 'secondary' : 'liberty'}
                size="sm"
                leftIcon={
                  t.status === 'concluida' ? (
                    <IconPencil size={14} stroke={2.5} />
                  ) : (
                    <IconCheck size={14} stroke={2.5} />
                  )
                }
                disabled={busy}
                onClick={() => abrirResposta('concluida')}
              >
                {t.status === 'concluida' ? 'Editar comentário' : 'Concluí'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={
                  t.status === 'nao_concluida' ? (
                    <IconPencil size={14} stroke={2.5} />
                  ) : (
                    <IconX size={14} stroke={2.5} />
                  )
                }
                disabled={busy}
                onClick={() => abrirResposta('nao_concluida')}
              >
                {t.status === 'nao_concluida' ? 'Editar motivo' : 'Não concluí'}
              </Button>
              {t.status !== 'pendente' && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => onResponder('pendente', null)}>
                  Desfazer resposta
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pedido de exclusão: só o responsável (não-ADM) e só com a tarefa concluída. */}
      {souResponsavel && !admSupremo && t.status === 'concluida' && !respondendo && (
        <div className="border-t border-neutral-100 pt-3 adobe-dark:border-adobe-line">
          {t.exclusaoSolicitadaEm ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500 adobe-dark:text-adobe-text-lo">
              Exclusão pedida em {formatDateTime(t.exclusaoSolicitadaEm)}.
              <button
                type="button"
                onClick={() => onPedidoExclusao(false)}
                disabled={busy}
                className="font-bold text-neutral-700 underline-offset-2 hover:underline cursor-pointer disabled:opacity-50 adobe-dark:text-adobe-text-md"
              >
                Cancelar pedido
              </button>
            </p>
          ) : (
            <AcaoAdm onClick={() => onPedidoExclusao(true)} disabled={busy} icon={<IconTrash size={13} stroke={2} />} danger>
              Pedir ao ADM para excluir
            </AcaoAdm>
          )}
        </div>
      )}

      {admSupremo && (
        <div className="flex flex-wrap items-center gap-1 border-t border-neutral-100 pt-3 adobe-dark:border-adobe-line">
          <AcaoAdm onClick={onEditar} disabled={busy} icon={<IconPencil size={13} stroke={2} />}>
            Editar
          </AcaoAdm>
          <AcaoAdm
            onClick={() => onFechar(!t.fechada)}
            disabled={busy}
            icon={t.fechada ? <IconLockOpen size={13} stroke={2} /> : <IconLock size={13} stroke={2} />}
          >
            {t.fechada ? 'Reabrir' : 'Fechar'}
          </AcaoAdm>
          <AcaoAdm onClick={onExcluir} disabled={busy} icon={<IconTrash size={13} stroke={2} />} danger>
            Excluir
          </AcaoAdm>
          {t.exclusaoSolicitadaEm && (
            <AcaoAdm onClick={() => onPedidoExclusao(false)} disabled={busy} icon={<IconX size={13} stroke={2} />}>
              Recusar pedido
            </AcaoAdm>
          )}
        </div>
      )}
    </li>
  )
}

function AcaoAdm({
  onClick,
  disabled,
  icon,
  danger,
  children,
}: {
  onClick: () => void
  disabled: boolean
  icon: React.ReactNode
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-ui cursor-pointer disabled:opacity-50 ' +
        (danger
          ? 'text-rose-600 hover:bg-rose-50 adobe-dark:text-rose-400 adobe-dark:hover:bg-rose-500/10'
          : 'text-neutral-600 hover:bg-neutral-100 adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-3')
      }
    >
      {icon}
      {children}
    </button>
  )
}

// ─── Modal criar/editar ──────────────────────────────────────────────────────

function TarefaModal({
  open,
  tarefa,
  usuarios,
  hoje,
  onClose,
  onSaved,
}: {
  open: boolean
  tarefa: Tarefa | null
  usuarios: UsuarioOpcao[]
  hoje: string
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [titulo, setTitulo] = useState(tarefa?.titulo ?? '')
  const [descricao, setDescricao] = useState(tarefa?.descricao ?? '')
  const [prazo, setPrazo] = useState(tarefa?.prazo ?? '')
  const [responsavelUid, setResponsavelUid] = useState(tarefa?.responsavelUid ?? '')
  const [errors, setErrors] = useState<TarefaFieldErrors>({})
  const [salvando, setSalvando] = useState(false)

  // Responsável antigo que não está mais na lista (ex.: perdeu o cargo) continua selecionável.
  const opcoes = useMemo(() => {
    const lista = usuarios.map((u) => ({ value: u.uid, label: u.email ? `${u.nome} (${u.email})` : u.nome }))
    if (tarefa && !usuarios.some((u) => u.uid === tarefa.responsavelUid)) {
      lista.unshift({ value: tarefa.responsavelUid, label: tarefa.responsavelNome })
    }
    return [{ value: '', label: 'Selecione o responsável' }, ...lista]
  }, [usuarios, tarefa])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const fd = new FormData()
      if (tarefa) fd.append('id', tarefa.id)
      fd.append('titulo', titulo)
      fd.append('descricao', descricao)
      fd.append('prazo', prazo)
      fd.append('responsavelUid', responsavelUid)
      const result = await salvarTarefa(fd)
      setErrors(result.fieldErrors ?? {})
      if (result.error) {
        if (!result.fieldErrors) toast.error(result.error)
        return
      }
      toast.success(result.success || 'Tarefa salva.')
      onSaved()
    } finally {
      setSalvando(false)
    }
  }

  const trocandoResponsavel = !!tarefa && tarefa.status !== 'pendente' && responsavelUid !== tarefa.responsavelUid

  return (
    <Modal
      open={open}
      onClose={() => !salvando && onClose()}
      title={tarefa ? 'Editar tarefa' : 'Nova tarefa'}
      description={tarefa ? undefined : 'Escolha o responsável e o prazo.'}
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Input
          label="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: ligar para o cliente do Corolla"
          maxLength={TAREFA_TITULO_MAX}
          error={errors.titulo}
          required
          autoFocus
        />
        <Textarea
          label="Descrição (opcional)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Detalhes do que precisa ser feito."
          rows={4}
          maxLength={TAREFA_DESCRICAO_MAX}
          error={errors.descricao}
        />
        <Select
          label="Responsável"
          value={responsavelUid}
          onChange={(e) => setResponsavelUid(e.target.value)}
          options={opcoes}
          error={errors.responsavelUid}
        />
        <div className="sm:w-1/2">
          <Input
            label="Prazo"
            type="date"
            value={prazo}
            min={tarefa ? undefined : hoje}
            onChange={(e) => setPrazo(e.target.value)}
            error={errors.prazo}
            required
          />
        </div>
        {trocandoResponsavel && (
          <p className="text-[11px] font-semibold text-amber-700 adobe-dark:text-amber-300">
            Trocar o responsável apaga a resposta atual e volta a tarefa para pendente.
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" variant="liberty" loading={salvando}>
            {tarefa ? 'Salvar' : 'Criar tarefa'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Lista de afazeres pessoal ───────────────────────────────────────────────

function ListaAfazeres({ inicial }: { inicial: Afazer[] }) {
  const toast = useToast()
  const [itens, setItens] = useState(inicial)
  const [novo, setNovo] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editTexto, setEditTexto] = useState('')
  const [salvando, setSalvando] = useState(0)
  // Fila de gravações: cada mudança grava a lista inteira, na ordem em que aconteceu.
  const filaRef = useRef<Promise<void>>(Promise.resolve())

  function persistir(proximos: Afazer[]) {
    setItens(proximos)
    setSalvando((n) => n + 1)
    filaRef.current = filaRef.current.then(async () => {
      try {
        const result = await salvarMeusAfazeres(proximos)
        if (result.error) toast.error(result.error)
      } catch {
        toast.error('Erro ao salvar a lista.')
      } finally {
        setSalvando((n) => n - 1)
      }
    })
  }

  function adicionar(e: React.FormEvent) {
    e.preventDefault()
    const texto = novo.trim()
    if (!texto) return
    if (itens.length >= AFAZERES_MAX) {
      toast.error(`Limite de ${AFAZERES_MAX} itens. Limpe os concluídos.`)
      return
    }
    persistir([...itens, { id: crypto.randomUUID(), texto, feito: false }])
    setNovo('')
  }

  function concluirEdicao() {
    if (!editandoId) return
    const texto = editTexto.trim()
    const atual = itens.find((i) => i.id === editandoId)
    setEditandoId(null)
    if (!atual || !texto || texto === atual.texto) return
    persistir(itens.map((i) => (i.id === editandoId ? { ...i, texto } : i)))
  }

  const pendentes = itens.filter((i) => !i.feito)
  const feitos = itens.filter((i) => i.feito)

  return (
    <section aria-label="Meus afazeres" className={CARD + ' p-4 space-y-3'}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="inline-flex items-center gap-1.5 text-sm font-bold text-neutral-950 adobe-dark:text-adobe-text-hi">
            <IconChecklist size={16} stroke={2} />
            Meus afazeres
          </h2>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-500 adobe-dark:text-adobe-text-lo">
            <IconLock size={11} stroke={2} />
            Só você vê.
          </p>
        </div>
        <p className="text-[11px] font-semibold text-neutral-500 tabular-nums adobe-dark:text-adobe-text-lo">
          {salvando > 0 ? 'Salvando…' : itens.length > 0 ? `${feitos.length} de ${itens.length} feitos` : ''}
        </p>
      </div>

      <form onSubmit={adicionar} className="flex gap-2">
        <Input
          aria-label="Novo item"
          placeholder="Adicionar item…"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          maxLength={AFAZER_TEXTO_MAX}
          containerClassName="flex-1"
        />
        <Button type="submit" variant="liberty" aria-label="Adicionar item" disabled={!novo.trim()}>
          <IconPlus size={16} stroke={2.5} />
        </Button>
      </form>

      {itens.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-neutral-500 adobe-dark:text-adobe-text-lo">
          Nada por aqui. Anote o que precisa fazer.
        </p>
      ) : (
        <ul className="space-y-1">
          {[...pendentes, ...feitos].map((item) => (
            <li
              key={item.id}
              className="group -mx-1.5 flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-neutral-50 adobe-dark:hover:bg-adobe-bg-3"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={item.feito}
                aria-label={item.feito ? `Desmarcar "${item.texto}"` : `Marcar "${item.texto}" como feito`}
                onClick={() =>
                  persistir(itens.map((i) => (i.id === item.id ? { ...i, feito: !i.feito } : i)))
                }
                className={
                  'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 transition-colors cursor-pointer ' +
                  (item.feito
                    ? 'border-liberty bg-liberty text-white'
                    : 'border-neutral-300 bg-white hover:border-liberty adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2')
                }
              >
                {item.feito && <IconCheck size={12} stroke={3} />}
              </button>

              {editandoId === item.id ? (
                <input
                  aria-label="Editar item"
                  value={editTexto}
                  onChange={(e) => setEditTexto(e.target.value)}
                  onBlur={concluirEdicao}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') concluirEdicao()
                    if (e.key === 'Escape') setEditandoId(null)
                  }}
                  maxLength={AFAZER_TEXTO_MAX}
                  autoFocus
                  className="min-w-0 flex-1 -my-px rounded border border-liberty/40 bg-white px-1 text-[13px] leading-[18px] text-neutral-900 outline-none adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-hi"
                />
              ) : (
                <button
                  type="button"
                  title="Clique para editar"
                  onClick={() => {
                    setEditTexto(item.texto)
                    setEditandoId(item.id)
                  }}
                  className={
                    'min-w-0 flex-1 break-words text-left text-[13px] leading-[18px] cursor-text ' +
                    (item.feito
                      ? 'text-neutral-400 line-through adobe-dark:text-adobe-text-lo'
                      : 'text-neutral-800 adobe-dark:text-adobe-text-md')
                  }
                >
                  {item.texto}
                </button>
              )}

              <button
                type="button"
                aria-label={`Remover "${item.texto}"`}
                onClick={() => persistir(itens.filter((i) => i.id !== item.id))}
                className="shrink-0 rounded p-0.5 text-neutral-400 transition-opacity hover:bg-rose-50 hover:text-rose-600 cursor-pointer md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 adobe-dark:hover:bg-rose-500/10"
              >
                <IconX size={14} stroke={2} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {feitos.length > 0 && (
        <div className="border-t border-neutral-100 pt-2 adobe-dark:border-adobe-line [&>button]:-ml-2">
          <AcaoAdm onClick={() => persistir(pendentes)} disabled={false} icon={<IconTrash size={13} stroke={2} />}>
            Limpar concluídos ({feitos.length})
          </AcaoAdm>
        </div>
      )}
    </section>
  )
}
