'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconAlertTriangle,
  IconBrandGoogle,
  IconCalendarEvent,
  IconClock,
  IconMapPin,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
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
import {
  desconectarGoogle,
  excluirCompromisso,
  iniciarConexaoGoogle,
  ressincronizarCompromisso,
  salvarCompromisso,
} from './actions'
import {
  AGENDA_DESCRICAO_MAX,
  AGENDA_LOCAL_MAX,
  AGENDA_TITULO_MAX,
  type AgendaResponse,
  type Compromisso,
  type CompromissoFieldErrors,
  type ConexaoGoogle,
  type UsuarioAgenda,
} from './types'

interface AgendaClientProps {
  compromissos: Compromisso[]
  conexao: ConexaoGoogle
  usuarios: UsuarioAgenda[]
  admSupremo: boolean
  meuUid: string
  /** `YYYY-MM-DD` no fuso do negócio — vem do servidor para não divergir. */
  hoje: string
}

const CARD =
  'rounded-2xl border border-neutral-200 bg-white shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2'
const CHIP = 'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer'
const CHIP_OFF = 'text-neutral-600 hover:bg-neutral-100 adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-3'

// ─── Datas (strings YYYY-MM-DD; Date.UTC só como aritmética de calendário) ──

function somarDias(data: string, n: number) {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const FMT_DIA = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  timeZone: 'UTC',
})

function rotuloDia(data: string, hoje: string) {
  const longo = FMT_DIA.format(new Date(`${data}T00:00:00Z`))
  const capital = longo.charAt(0).toUpperCase() + longo.slice(1)
  if (data === hoje) return `Hoje · ${capital}`
  if (data === somarDias(hoje, 1)) return `Amanhã · ${capital}`
  if (data === somarDias(hoje, -1)) return `Ontem · ${capital}`
  return capital
}

function horario(c: Compromisso) {
  if (c.diaInteiro || !c.horaInicio) return 'Dia inteiro'
  return c.horaFim ? `${c.horaInicio} – ${c.horaFim}` : c.horaInicio
}

export default function AgendaClient({ compromissos, conexao, usuarios, admSupremo, meuUid, hoje }: AgendaClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [verAnteriores, setVerAnteriores] = useState(false)
  const [filtroPessoa, setFiltroPessoa] = useState('')
  const [editando, setEditando] = useState<Compromisso | 'novo' | null>(null)
  const [excluir, setExcluir] = useState<Compromisso | null>(null)
  const [confirmDesconectar, setConfirmDesconectar] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const executar = useCallback(
    async (acao: () => Promise<AgendaResponse>, onOk?: () => void) => {
      setOcupado(true)
      try {
        const r = await acao()
        if (r.error) toast.error(r.error)
        else {
          toast.success(r.success || 'Feito.')
          if (r.aviso) toast.error(r.aviso, 'Google Agenda')
          onOk?.()
          router.refresh()
        }
      } finally {
        setOcupado(false)
      }
    },
    [router, toast],
  )

  async function conectar() {
    setOcupado(true)
    try {
      const r = await iniciarConexaoGoogle()
      if (r.error || !r.url) {
        toast.error(r.error || 'Não foi possível iniciar a conexão.')
        return
      }
      // No app desktop esta navegação externa abre no navegador do sistema.
      window.location.href = r.url
    } finally {
      setOcupado(false)
    }
  }

  const proximos = useMemo(() => compromissos.filter((c) => c.data >= hoje), [compromissos, hoje])
  const anteriores = useMemo(() => compromissos.filter((c) => c.data < hoje).reverse(), [compromissos, hoje])

  const grupos = useMemo(() => {
    const base = (verAnteriores ? anteriores : proximos).filter(
      (c) => !filtroPessoa || c.participantes.some((p) => p.uid === filtroPessoa),
    )
    const mapa = new Map<string, Compromisso[]>()
    for (const c of base) mapa.set(c.data, [...(mapa.get(c.data) ?? []), c])
    return [...mapa.entries()]
  }, [verAnteriores, anteriores, proximos, filtroPessoa])

  return (
    <div className="space-y-5 pb-28 md:space-y-6 md:pb-0">
      {/* pt-6 no mobile: o título não pode ficar embaixo do botão fixo do menu (☰). */}
      <header className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start sm:justify-between md:pt-0">
        <div className="min-w-0 flex-1">
          <div className="hidden md:block">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Agenda' }]} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-950 md:mt-1 md:text-3xl adobe-dark:text-adobe-text-hi">
            Agenda
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 md:mt-1 md:text-sm adobe-dark:text-adobe-text-lo">
            {admSupremo
              ? 'Marque compromissos para a equipe. Quem conectou o Google Agenda recebe o evento automaticamente.'
              : 'Seus compromissos. Conecte o Google Agenda para recebê-los automaticamente na sua agenda.'}
          </p>
        </div>
        {admSupremo && (
          <Button variant="liberty" leftIcon={<IconPlus size={16} stroke={2.5} />} onClick={() => setEditando('novo')}>
            Novo compromisso
          </Button>
        )}
      </header>

      {/* Conexão com o Google */}
      <section className={CARD + ' flex flex-wrap items-center gap-3 p-4'}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700 adobe-dark:bg-adobe-bg-3 adobe-dark:text-adobe-text-md">
          <IconBrandGoogle size={20} stroke={2} />
        </span>
        <div className="min-w-0 flex-1">
          {!conexao.configurada ? (
            <>
              <p className="text-sm font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">Google Agenda</p>
              <p className="text-xs text-neutral-500 adobe-dark:text-adobe-text-lo">
                A integração com o Google Agenda ainda não foi configurada. Os compromissos ficam só no painel por enquanto.
              </p>
            </>
          ) : conexao.email ? (
            <>
              <p className="text-sm font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">Google Agenda conectado</p>
              <p className="truncate text-xs text-neutral-500 adobe-dark:text-adobe-text-lo">{conexao.email}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">Conecte seu Google Agenda</p>
              <p className="text-xs text-neutral-500 adobe-dark:text-adobe-text-lo">
                Seus compromissos passam a aparecer sozinhos na sua agenda do Google, no celular e no computador.
              </p>
            </>
          )}
        </div>
        {conexao.configurada &&
          (conexao.email ? (
            <Button variant="secondary" size="sm" disabled={ocupado} onClick={() => setConfirmDesconectar(true)}>
              Desconectar
            </Button>
          ) : (
            <Button variant="liberty" size="sm" loading={ocupado} onClick={conectar}>
              Conectar Google Agenda
            </Button>
          ))}
      </section>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-1 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
          {(
            [
              [false, `Próximos (${proximos.length})`],
              [true, `Anteriores (${anteriores.length})`],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={String(valor)}
              type="button"
              onClick={() => setVerAnteriores(valor)}
              className={CHIP + ' ' + (verAnteriores === valor ? 'bg-liberty text-white shadow-xs' : CHIP_OFF)}
            >
              {rotulo}
            </button>
          ))}
        </div>
        {admSupremo && usuarios.length > 0 && (
          <div className="w-full sm:w-60">
            <Select
              aria-label="Filtrar por participante"
              value={filtroPessoa}
              onChange={(e) => setFiltroPessoa(e.target.value)}
              options={[{ value: '', label: 'Todos os participantes' }, ...usuarios.map((u) => ({ value: u.uid, label: u.nome }))]}
            />
          </div>
        )}
      </div>

      {/* Lista por dia */}
      {grupos.length === 0 ? (
        <EmptyState
          icon={<IconCalendarEvent size={24} stroke={1.5} />}
          title={verAnteriores ? 'Nenhum compromisso anterior' : 'Nenhum compromisso marcado'}
          description={
            admSupremo
              ? 'Crie um compromisso, escolha a data, o horário e os participantes.'
              : 'Quando a administração marcar um compromisso com você, ele aparece aqui.'
          }
          action={
            admSupremo && !verAnteriores ? (
              <Button variant="liberty" size="sm" leftIcon={<IconPlus size={14} stroke={2.5} />} onClick={() => setEditando('novo')}>
                Novo compromisso
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {grupos.map(([data, itens]) => (
            <section key={data} className="space-y-2">
              <h2
                className={
                  'text-xs font-extrabold uppercase tracking-wider ' +
                  (data === hoje ? 'text-liberty-deep adobe-dark:text-adobe-accent-soft' : 'text-neutral-500 adobe-dark:text-adobe-text-lo')
                }
              >
                {rotuloDia(data, hoje)}
              </h2>
              <ul className="space-y-2">
                {itens.map((c) => (
                  <CompromissoCard
                    key={c.id}
                    c={c}
                    admSupremo={admSupremo}
                    meuUid={meuUid}
                    integracao={conexao.configurada}
                    ocupado={ocupado}
                    onEditar={() => setEditando(c)}
                    onExcluir={() => setExcluir(c)}
                    onRessincronizar={() => executar(() => ressincronizarCompromisso(c.id))}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {admSupremo && editando !== null && (
        <CompromissoModal
          key={editando === 'novo' ? 'novo' : editando.id}
          compromisso={editando === 'novo' ? null : editando}
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
        open={excluir !== null}
        onClose={() => !ocupado && setExcluir(null)}
        onConfirm={() => excluir && executar(() => excluirCompromisso(excluir.id), () => setExcluir(null))}
        title="Excluir compromisso"
        description="O compromisso sai do painel e do Google Agenda dos participantes."
        confirmLabel="Excluir"
        tone="danger"
        loading={ocupado}
      />

      <ConfirmDialog
        open={confirmDesconectar}
        onClose={() => !ocupado && setConfirmDesconectar(false)}
        onConfirm={() => executar(() => desconectarGoogle(), () => setConfirmDesconectar(false))}
        title="Desconectar Google Agenda"
        description="Novos compromissos deixam de ir para o seu Google. Os eventos já criados continuam lá."
        confirmLabel="Desconectar"
        loading={ocupado}
      />
    </div>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────

function CompromissoCard({
  c,
  admSupremo,
  meuUid,
  integracao,
  ocupado,
  onEditar,
  onExcluir,
  onRessincronizar,
}: {
  c: Compromisso
  admSupremo: boolean
  meuUid: string
  integracao: boolean
  ocupado: boolean
  onEditar: () => void
  onExcluir: () => void
  onRessincronizar: () => void
}) {
  const comErro = c.participantes.some((p) => p.erro)
  return (
    <li className={CARD + ' p-4'}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-liberty/10 px-2.5 py-1 text-xs font-bold tabular-nums text-liberty-deep adobe-dark:bg-adobe-accent/15 adobe-dark:text-adobe-accent-soft">
          <IconClock size={13} stroke={2.2} />
          {horario(c)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-neutral-950 adobe-dark:text-adobe-text-hi">{c.titulo}</h3>
          {c.local && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-600 adobe-dark:text-adobe-text-md">
              <IconMapPin size={13} stroke={2} className="shrink-0" />
              {c.local}
            </p>
          )}
          {c.descricao && (
            <p className="mt-1.5 whitespace-pre-line text-xs text-neutral-600 adobe-dark:text-adobe-text-md">{c.descricao}</p>
          )}
        </div>
        {admSupremo && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onEditar}
              aria-label="Editar compromisso"
              className="grid h-8 w-8 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition-ui cursor-pointer adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-md"
            >
              <IconPencil size={14} stroke={2.2} />
            </button>
            <button
              type="button"
              onClick={onExcluir}
              aria-label="Excluir compromisso"
              className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 transition-ui cursor-pointer adobe-dark:border-rose-400/30 adobe-dark:bg-adobe-bg-2"
            >
              <IconTrash size={14} stroke={2.2} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {c.participantes.map((p) => {
          const souEu = p.uid === meuUid
          const estado = !integracao
            ? null
            : p.erro
              ? { cls: 'border-rose-200 bg-rose-50 text-rose-700 adobe-dark:border-rose-400/30 adobe-dark:bg-rose-400/10 adobe-dark:text-rose-300', dica: `Erro no Google: ${p.erro}` }
              : p.sincronizado
                ? { cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 adobe-dark:border-emerald-400/30 adobe-dark:bg-emerald-400/10 adobe-dark:text-emerald-300', dica: 'No Google Agenda' }
                : { cls: 'border-neutral-200 bg-neutral-50 text-neutral-500 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-3 adobe-dark:text-adobe-text-lo', dica: p.conectado ? 'Ainda não enviado ao Google' : 'Não conectou o Google Agenda' }
          return (
            <span
              key={p.uid}
              title={estado?.dica}
              className={
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ' +
                (estado?.cls ?? 'border-neutral-200 bg-neutral-50 text-neutral-600 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-3 adobe-dark:text-adobe-text-md')
              }
            >
              {estado && (p.erro ? <IconAlertTriangle size={11} stroke={2.5} /> : <IconBrandGoogle size={11} stroke={2.5} />)}
              {p.nome}
              {souEu ? ' (você)' : ''}
            </span>
          )
        })}
        {admSupremo && comErro && (
          <button
            type="button"
            disabled={ocupado}
            onClick={onRessincronizar}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50 cursor-pointer disabled:opacity-50 adobe-dark:text-rose-300"
          >
            <IconRefresh size={12} stroke={2.5} />
            Tentar de novo
          </button>
        )}
      </div>
    </li>
  )
}

// ─── Modal criar/editar ──────────────────────────────────────────────────────

function CompromissoModal({
  compromisso,
  usuarios,
  hoje,
  onClose,
  onSaved,
}: {
  compromisso: Compromisso | null
  usuarios: UsuarioAgenda[]
  hoje: string
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [titulo, setTitulo] = useState(compromisso?.titulo ?? '')
  const [data, setData] = useState(compromisso?.data ?? hoje)
  const [diaInteiro, setDiaInteiro] = useState(compromisso?.diaInteiro ?? false)
  const [horaInicio, setHoraInicio] = useState(compromisso?.horaInicio ?? '')
  const [horaFim, setHoraFim] = useState(compromisso?.horaFim ?? '')
  const [local, setLocal] = useState(compromisso?.local ?? '')
  const [descricao, setDescricao] = useState(compromisso?.descricao ?? '')
  const [participantes, setParticipantes] = useState(
    () => new Set(compromisso?.participantes.map((p) => p.uid) ?? []),
  )
  const [errors, setErrors] = useState<CompromissoFieldErrors>({})
  const [salvando, setSalvando] = useState(false)

  // Participante antigo que não está mais na lista continua aparecendo.
  const opcoes = useMemo(() => {
    const lista = [...usuarios]
    compromisso?.participantes.forEach((p) => {
      if (!lista.some((u) => u.uid === p.uid)) lista.push({ uid: p.uid, nome: p.nome, email: '' })
    })
    return lista
  }, [usuarios, compromisso])

  function alternar(uid: string) {
    setParticipantes((atual) => {
      const novo = new Set(atual)
      if (novo.has(uid)) novo.delete(uid)
      else novo.add(uid)
      return novo
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const fd = new FormData()
      if (compromisso) fd.append('id', compromisso.id)
      fd.append('titulo', titulo)
      fd.append('data', data)
      fd.append('diaInteiro', String(diaInteiro))
      fd.append('horaInicio', horaInicio)
      fd.append('horaFim', horaFim)
      fd.append('local', local)
      fd.append('descricao', descricao)
      participantes.forEach((uid) => fd.append('participantes', uid))
      const r = await salvarCompromisso(fd)
      setErrors(r.fieldErrors ?? {})
      if (r.error) {
        if (!r.fieldErrors) toast.error(r.error)
        return
      }
      toast.success(r.success || 'Compromisso salvo.')
      if (r.aviso) toast.error(r.aviso, 'Google Agenda')
      onSaved()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !salvando && onClose()}
      title={compromisso ? 'Editar compromisso' : 'Novo compromisso'}
      description="Os participantes que conectaram o Google Agenda recebem o evento automaticamente."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Input
          label="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: Reunião com o banco"
          maxLength={AGENDA_TITULO_MAX}
          error={errors.titulo}
          required
          autoFocus
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            error={errors.data}
            required
            // No iOS o input de data tem largura mínima própria e pode vazar do modal.
            className="min-w-0 appearance-none"
          />
          {!diaInteiro && (
            <>
              <Input
                label="Início"
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                error={errors.horaInicio}
                required
                className="min-w-0 appearance-none"
              />
              <Input
                label="Fim (opcional)"
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                error={errors.horaFim}
                className="min-w-0 appearance-none"
              />
            </>
          )}
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-700 adobe-dark:text-adobe-text-md">
          <input
            type="checkbox"
            checked={diaInteiro}
            onChange={(e) => setDiaInteiro(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[var(--color-liberty,#0284c7)]"
          />
          Dia inteiro
        </label>
        <Input
          label="Local (opcional)"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Ex: Loja Jaú"
          maxLength={AGENDA_LOCAL_MAX}
        />
        <Textarea
          label="Descrição (opcional)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          maxLength={AGENDA_DESCRICAO_MAX}
        />
        <div>
          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 adobe-dark:text-adobe-text-lo">
            Participantes
          </p>
          <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-neutral-200 p-1.5 sm:grid-cols-2 adobe-dark:border-adobe-line">
            {opcoes.map((u) => (
              <li key={u.uid}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-neutral-50 adobe-dark:hover:bg-adobe-bg-3">
                  <input
                    type="checkbox"
                    checked={participantes.has(u.uid)}
                    onChange={() => alternar(u.uid)}
                    className="h-4 w-4 cursor-pointer accent-[var(--color-liberty,#0284c7)]"
                  />
                  <span className="min-w-0 truncate text-sm text-neutral-800 adobe-dark:text-adobe-text-hi">{u.nome}</span>
                </label>
              </li>
            ))}
          </ul>
          {errors.participantes && <p className="mt-1.5 text-xs font-semibold text-rose-600">{errors.participantes}</p>}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" variant="liberty" loading={salvando}>
            {compromisso ? 'Salvar' : 'Criar compromisso'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
