'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconPlus,
  IconTool,
  IconPencil,
  IconTrash,
  IconBuildingWarehouse,
  IconUser,
  IconCalendar,
  IconReceipt2,
  IconEye,
  IconArrowBackUp,
} from '@tabler/icons-react'
import {
  Button,
  Input,
  Textarea,
  Select,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
  StatusBadge,
  ConfirmDialog,
  Breadcrumb,
  useToast,
} from '@/app/components/ui'
import { useDebounce } from '@/utils/useDebounce'
import { formatCurrency, formatDate } from '@/utils/format'
import type { BadgeTone } from '@/app/components/ui/StatusBadge'
import {
  createManutencao,
  updateManutencao,
  deleteManutencao,
  estornarBaixaManutencao,
} from './actions'
import {
  isManutencaoBaixada,
  valorManutencao,
  type Manutencao,
  type ManutencaoStatus,
} from './types'
import {
  ConsertoPecasModal,
  type PecaValor,
} from './ConsertoPecasModal'
import BaixaManutencaoModal from './BaixaManutencaoModal'

type Status = ManutencaoStatus

const STATUS_LABELS: Record<Status, string> = {
  agendada: 'Agendada',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const STATUS_TONE: Record<Status, BadgeTone> = {
  agendada: 'info',
  em_execucao: 'warning',
  concluida: 'success',
  cancelada: 'neutral',
}

const TIPOS = [
  'Troca de óleo',
  'Revisão periódica',
  'Alinhamento e balanceamento',
  'Troca de pneus',
  'Funilaria e pintura',
  'Diagnóstico eletrônico',
  'Conserto de peças',
  'Outro',
]

const TIPO_CONSERTO_PECAS = 'Conserto de peças'

const PAGE_SIZE = 12

// Botão de ação compacto (só ícone) para a coluna "Ações" da tabela — mantém a
// linha em uma altura só e evita a quebra feia com 3–4 botões rotulados.
const ICON_ACTION_CLS =
  'inline-flex items-center justify-center rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-liberty/40 cursor-pointer'

interface Props {
  veiculos: { id: string; marca: string; modelo: string; ano: number; placa: string | null }[]
  initialManutencoes: Manutencao[]
}

export default function ManutencaoClient({ veiculos, initialManutencoes }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<Manutencao[]>(initialManutencoes)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Manutencao | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | Status>('todos')
  const [confirmDelete, setConfirmDelete] = useState<Manutencao | null>(null)
  const [page, setPage] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [pecasModalOpen, setPecasModalOpen] = useState(false)
  const [pecasState, setPecasState] = useState<PecaValor[]>([])
  const [tipoSelecionado, setTipoSelecionado] = useState<string>('')
  // Baixa: valor + comprovante são informados aqui, não no cadastro.
  const [baixaDe, setBaixaDe] = useState<Manutencao | null>(null)
  const [confirmEstorno, setConfirmEstorno] = useState<Manutencao | null>(null)
  const debouncedSearch = useDebounce(search, 250)
  const toast = useToast()

  // Depois de `router.refresh()` (cadastro, baixa, estorno) o servidor manda uma
  // nova lista via props — reconcilia o estado local aqui, senão a tabela só
  // atualizava com um F5. Padrão "ajustar state quando prop muda" (feito no
  // render, não em efeito). O delete continua fazendo update otimista antes.
  const [lastInitial, setLastInitial] = useState(initialManutencoes)
  if (lastInitial !== initialManutencoes) {
    setLastInitial(initialManutencoes)
    setItems(initialManutencoes)
  }

  function openCreate() {
    setEditing(null)
    setPecasState([])
    setTipoSelecionado('')
    setShowForm(true)
  }

  function openEdit(m: Manutencao) {
    setEditing(m)
    setPecasState([])
    setTipoSelecionado(m.tipo ?? '')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setTipoSelecionado('')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)

    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const veiculoId = (form.get('veiculoId') as string) || ''
    const veiculoLabelFromSelect = veiculoId
      ? (() => {
          const v = veiculos.find((x) => x.id === veiculoId)
          return v ? `${v.marca} ${v.modelo} ${v.ano}${v.placa ? ' • ' + v.placa : ''}` : ''
        })()
      : ''
    if (veiculoLabelFromSelect) {
      form.set('veiculoLabel', veiculoLabelFromSelect)
    }

    // Se o user usou o modal de peças, anexa a lista à descrição antes do submit
    // (apenas quando ainda não houver descrição manual).
    if (pecasState.length > 0) {
      const descricaoExistente = ((form.get('descricao') as string) || '').trim()
      const linhas = pecasState
        .map((p) => `- ${p.peca}: ${formatCurrency(p.valor)}`)
        .join('\n')
      const bloco = `Conserto de peças:\n${linhas}\nTotal: ${formatCurrency(
        pecasState.reduce((acc, p) => acc + p.valor, 0),
      )}`
      form.set(
        'descricao',
        descricaoExistente ? `${descricaoExistente}\n\n${bloco}` : bloco,
      )
      // Envia também como JSON estruturado para a coluna `pecasConserto`
      form.set(
        'pecasConserto',
        JSON.stringify(
          pecasState.map((p) => ({ nome: p.peca, valor: p.valor })),
        ),
      )
    } else {
      form.set('pecasConserto', '')
    }

    // Sanity check client-side antes de ir ao servidor — UX mais rápida.
    const tipo = (form.get('tipo') as string)?.trim()
    const oficina = (form.get('oficina') as string)?.trim()
    const responsavel = (form.get('responsavel') as string)?.trim()
    const veiculoLabel = ((form.get('veiculoLabel') as string) || '').trim()
    const dataAgendada = ((form.get('dataAgendada') as string) || '').trim()

    if (!veiculoLabel || !tipo || !oficina || !responsavel || !dataAgendada) {
      toast.error('Preencha os campos obrigatórios.')
      setSubmitting(false)
      return
    }

    try {
      const result = editing
        ? await updateManutencao(editing.id, form)
        : await createManutencao(form)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(result.success || (editing ? 'Manutenção atualizada.' : 'Manutenção cadastrada.'))
      router.refresh()
      closeForm()
    } catch (err: any) {
      toast.error(err?.message || 'Erro inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(m: Manutencao) {
    if (submitting) return
    setSubmitting(true)
    const target = m
    setConfirmDelete(null)

    // Optimistic update — remove já do estado local para feedback imediato;
    // se o servidor falhar, restaura via router.refresh().
    setItems((prev) => prev.filter((x) => x.id !== target.id))

    try {
      const result = await deleteManutencao(target.id)
      if (result.error) {
        toast.error(result.error)
        // restaura
        router.refresh()
      } else {
        toast.success(result.success || 'Manutenção removida.')
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover.')
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEstorno(m: Manutencao) {
    if (submitting) return
    setSubmitting(true)
    setConfirmEstorno(null)
    try {
      const result = await estornarBaixaManutencao(m.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success || 'Baixa estornada.')
      }
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao estornar.')
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = useMemo(() => {
    return items.filter((m) => {
      const matchesStatus = filterStatus === 'todos' || m.status === filterStatus
      const term = debouncedSearch.toLowerCase()
      const matchesSearch =
        !term ||
        m.veiculoLabel.toLowerCase().includes(term) ||
        m.tipo.toLowerCase().includes(term) ||
        m.oficina.toLowerCase().includes(term) ||
        m.responsavel.toLowerCase().includes(term)
      return matchesStatus && matchesSearch
    })
  }, [items, debouncedSearch, filterStatus])

  const totalCusto = useMemo(
    () =>
      filtered.reduce(
        (acc, m) => acc + (isManutencaoBaixada(m) ? valorManutencao(m) : 0),
        0,
      ),
    [filtered],
  )
  const aguardandoBaixa = useMemo(
    () => items.filter((m) => m.status !== 'cancelada' && !isManutencaoBaixada(m)).length,
    [items],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const visible = filtered.slice(start, start + PAGE_SIZE)
  const fromItem = filtered.length === 0 ? 0 : start + 1
  const toItem = Math.min(start + PAGE_SIZE, filtered.length)

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Manutenção' }]}
      />

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Módulo de Manutenção</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Ordens de serviço, agendamentos e histórico de manutenções da frota.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
            Ordens abertas
          </p>
          <p className="mt-1 text-2xl font-bold text-neutral-950">
            {items.filter((m) => m.status === 'agendada' || m.status === 'em_execucao').length}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
            Aguardando baixa
          </p>
          <p className="mt-1 text-2xl font-bold text-neutral-950">{aguardandoBaixa}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
            Concluídas
          </p>
          <p className="mt-1 text-2xl font-bold text-neutral-950">
            {items.filter((m) => m.status === 'concluida').length}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
            Custo baixado (filtrado)
          </p>
          <p className="mt-1 text-2xl font-bold text-neutral-950">{formatCurrency(totalCusto)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Buscar por veículo, oficina, tipo..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            containerClassName="w-full sm:w-72"
          />
          <Select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as 'todos' | Status)
              setPage(1)
            }}
            containerClassName="w-full sm:w-48"
            aria-label="Filtrar por status"
          >
            <option value="todos">Todos os status</option>
            <option value="agendada">Agendada</option>
            <option value="em_execucao">Em execução</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-neutral-500 hidden sm:block whitespace-nowrap">
            {filtered.length === 0
              ? '0 itens'
              : `Mostrando ${fromItem}–${toItem} de ${filtered.length}`}
          </div>
          <Button
            variant="liberty"
            onClick={openCreate}
            leftIcon={<IconPlus size={16} stroke={2.5} />}
          >
            Nova Manutenção
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-neutral-900 mb-5 flex items-center gap-2">
            <IconTool size={20} className="text-liberty-deep" />
            {editing ? 'Editar Manutenção' : 'Cadastrar Manutenção'}
          </h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Veículo (cadastrado) *"
              name="veiculoId"
              defaultValue={editing?.veiculoId ?? ''}
              onChange={(e) => {
                const id = e.currentTarget.value
                const free = e.currentTarget.form?.elements.namedItem('veiculoLabel') as HTMLInputElement | null
                if (free && id) free.value = ''
              }}
            >
              <option value="">— Selecionar do estoque —</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.marca} {v.modelo} {v.ano} {v.placa ? `• ${v.placa}` : ''}
                </option>
              ))}
            </Select>


            <div className="space-y-1.5">
              <Select
                label="Tipo *"
                name="tipo"
                required
                defaultValue={editing?.tipo ?? ''}
                onChange={(e) => {
                  const value = e.target.value
                  setTipoSelecionado(value)
                  if (value === TIPO_CONSERTO_PECAS) {
                    setPecasModalOpen(true)
                  }
                }}
              >
                <option value="" disabled>
                  Selecione
                </option>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              {tipoSelecionado === TIPO_CONSERTO_PECAS && (
                <button
                  type="button"
                  onClick={() => setPecasModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/40 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-liberty/40 hover:bg-liberty/5 hover:text-liberty-deep transition-ui cursor-pointer"
                >
                  <IconTool size={12} stroke={2.5} />
                  {pecasState.length > 0
                    ? `Editar peças (${pecasState.length})`
                    : 'Selecionar peças'}
                </button>
              )}
            </div>

            <Select
              label="Status"
              name="status"
              defaultValue={editing?.status ?? 'agendada'}
            >
              <option value="agendada">Agendada</option>
              <option value="em_execucao">Em execução</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </Select>

            <Input
              label="Oficina"
              name="oficina"
              required
              defaultValue={editing?.oficina}
              placeholder="Nome da oficina"
              leftIcon={<IconBuildingWarehouse size={14} />}
            />

            <Input
              label="Responsável"
              name="responsavel"
              required
              defaultValue={editing?.responsavel}
              placeholder="Quem está acompanhando"
              leftIcon={<IconUser size={14} />}
            />

            <Input
              label="Data agendada"
              name="dataAgendada"
              type="date"
              required
              defaultValue={editing?.dataAgendada}
              leftIcon={<IconCalendar size={14} />}
            />

            <Input
              label="Data conclusão"
              name="dataConclusao"
              type="date"
              defaultValue={editing?.dataConclusao ?? ''}
              leftIcon={<IconCalendar size={14} />}
            />

            <Textarea
              label="Descrição"
              name="descricao"
              rows={3}
              defaultValue={editing?.descricao ?? ''}
              placeholder="Serviços a serem executados..."
              containerClassName="sm:col-span-2"
            />

            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={closeForm}>
                Cancelar
              </Button>
              <Button type="submit" variant="liberty" disabled={submitting}>
                {submitting
                  ? 'Salvando...'
                  : editing
                    ? 'Salvar Alterações'
                    : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={<IconTool size={24} />}
          title="Nenhuma manutenção encontrada"
          description="Ajuste os filtros ou cadastre uma nova ordem de serviço."
        />
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
          <Table>
            <THead>
              <tr>
                <TH>Veículo / Tipo</TH>
                <TH>Oficina / Resp.</TH>
                <TH className="whitespace-nowrap">Agendada</TH>
                <TH className="whitespace-nowrap">Conclusão</TH>
                <TH align="right" className="whitespace-nowrap">Valor da baixa</TH>
                <TH>Status</TH>
                <TH align="right">Ações</TH>
              </tr>
            </THead>
            <TBody>
              {visible.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <div className="font-semibold text-neutral-900">{m.veiculoLabel}</div>
                    <div className="text-xs text-neutral-500">{m.tipo}</div>
                  </TD>
                  <TD>
                    <div className="max-w-[16rem] truncate" title={m.oficina}>{m.oficina}</div>
                    <div className="text-xs text-neutral-500 max-w-[16rem] truncate" title={m.responsavel}>
                      {m.responsavel}
                    </div>
                  </TD>
                  <TD className="text-xs whitespace-nowrap">{formatDate(m.dataAgendada)}</TD>
                  <TD className="text-xs whitespace-nowrap">{formatDate(m.dataConclusao)}</TD>
                  <TD align="right" className="font-semibold text-neutral-900">
                    {isManutencaoBaixada(m) ? (
                      formatCurrency(valorManutencao(m))
                    ) : (
                      <span className="text-xs font-medium text-amber-600">Aguardando baixa</span>
                    )}
                  </TD>
                  <TD>
                    <StatusBadge tone={STATUS_TONE[m.status]}>{STATUS_LABELS[m.status]}</StatusBadge>
                  </TD>
                  <TD align="right">
                    <div className="flex items-center justify-end gap-1">
                      {m.baixa ? (
                        <>
                          {m.baixa.comprovante && (
                            <a
                              href={`/api/manutencao/${m.id}/comprovante`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={ICON_ACTION_CLS}
                              title="Ver comprovante"
                              aria-label="Ver comprovante"
                            >
                              <IconEye size={16} stroke={2} />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirmEstorno(m)}
                            className={ICON_ACTION_CLS}
                            title="Estornar baixa"
                            aria-label="Estornar baixa"
                          >
                            <IconArrowBackUp size={16} stroke={2} />
                          </button>
                        </>
                      ) : (
                        m.status !== 'cancelada' && (
                          <Button
                            size="sm"
                            variant="liberty"
                            onClick={() => setBaixaDe(m)}
                            leftIcon={<IconReceipt2 size={12} />}
                          >
                            Dar baixa
                          </Button>
                        )
                      )}
                      <span className="mx-0.5 h-5 w-px bg-neutral-200" aria-hidden />
                      <button
                        type="button"
                        onClick={() => openEdit(m)}
                        className={ICON_ACTION_CLS}
                        title="Editar manutenção"
                        aria-label="Editar manutenção"
                      >
                        <IconPencil size={16} stroke={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(m)}
                        className={`${ICON_ACTION_CLS} !text-rose-600 hover:!bg-rose-50 hover:!text-rose-700`}
                        title="Remover manutenção"
                        aria-label="Remover manutenção"
                      >
                        <IconTrash size={16} stroke={2} />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-neutral-200 bg-neutral-50/60">
              <span className="text-xs text-neutral-500">
                Página {safePage} de {totalPages}
              </span>
              <div className="inline-flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConsertoPecasModal
        key={pecasModalOpen ? 'open' : 'closed'}
        open={pecasModalOpen}
        onClose={() => setPecasModalOpen(false)}
        initial={pecasState}
        onConfirm={(pecas) => {
          // As peças ficam registradas como planejadas; o valor real da
          // manutenção só é definido na baixa.
          setPecasState(pecas)
        }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Remover manutenção?"
        description={
          confirmDelete ? (
            <>
              Esta ação é local. Tem certeza que deseja remover a manutenção do veículo{' '}
              <strong>{confirmDelete.veiculoLabel}</strong>?
            </>
          ) : null
        }
        confirmLabel="Remover"
        tone="danger"
      />

      <ConfirmDialog
        open={!!confirmEstorno}
        onClose={() => setConfirmEstorno(null)}
        onConfirm={() => confirmEstorno && handleEstorno(confirmEstorno)}
        title="Estornar baixa?"
        description={
          confirmEstorno ? (
            <>
              O valor de <strong>{formatCurrency(valorManutencao(confirmEstorno))}</strong> e o
              comprovante (se houver) da manutenção de{' '}
              <strong>{confirmEstorno.veiculoLabel}</strong> serão removidos. A manutenção sai do
              custo efetivo total do veículo.
            </>
          ) : null
        }
        confirmLabel="Estornar"
        tone="danger"
      />

      <BaixaManutencaoModal
        manutencao={baixaDe}
        onClose={() => setBaixaDe(null)}
        onDone={() => {
          setBaixaDe(null)
          router.refresh()
        }}
      />
    </div>
  )
}
