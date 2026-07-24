'use client'

import { useMemo, useState } from 'react'
import {
  IconPlus,
  IconTool,
  IconPencil,
  IconTrash,
  IconCar,
  IconBuildingWarehouse,
  IconUser,
  IconCalendar,
  IconCash,
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
import { maskMoney, parseMoney } from '@/utils/masks'
import type { BadgeTone } from '@/app/components/ui/StatusBadge'

type Status = 'agendada' | 'em_execucao' | 'concluida' | 'cancelada'

interface Manutencao {
  id: string
  veiculoId: string
  veiculoLabel: string
  tipo: string
  descricao: string
  oficina: string
  responsavel: string
  custo: number
  dataAgendada: string
  dataConclusao: string
  status: Status
}

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
  'Outro',
]

const initialData: Manutencao[] = [
  {
    id: 'm-1',
    veiculoId: '',
    veiculoLabel: 'Honda Civic 2023',
    tipo: 'Troca de óleo',
    descricao: 'Troca de óleo 5W30 + filtro',
    oficina: 'Auto Center Premium',
    responsavel: 'Carlos Souza',
    custo: 480,
    dataAgendada: '2026-07-22',
    dataConclusao: '',
    status: 'agendada',
  },
  {
    id: 'm-2',
    veiculoId: '',
    veiculoLabel: 'Toyota Corolla 2022',
    tipo: 'Alinhamento e balanceamento',
    descricao: 'Alinhamento 3D + balanceamento',
    oficina: 'Pneu Center',
    responsavel: 'Mariana Alves',
    custo: 220,
    dataAgendada: '2026-07-10',
    dataConclusao: '2026-07-11',
    status: 'concluida',
  },
]

const PAGE_SIZE = 12

function genId() {
  return 'm-' + Math.random().toString(36).slice(2, 9)
}

interface Props {
  veiculos: { id: string; marca: string; modelo: string; ano: number; placa: string | null }[]
}

export default function ManutencaoClient({ veiculos }: Props) {
  const [items, setItems] = useState<Manutencao[]>(initialData)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Manutencao | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | Status>('todos')
  const [confirmDelete, setConfirmDelete] = useState<Manutencao | null>(null)
  const [page, setPage] = useState(1)
  const [custo, setCusto] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const toast = useToast()

  function openCreate() {
    setEditing(null)
    setCusto('')
    setShowForm(true)
  }

  function openEdit(m: Manutencao) {
    setEditing(m)
    setCusto(m.custo ? maskMoney(m.custo.toString()) : '')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setCusto('')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const veiculoId = (form.get('veiculoId') as string) || ''
    const veiculoLabel =
      veiculoId
        ? (() => {
            const v = veiculos.find((x) => x.id === veiculoId)
            return v ? `${v.marca} ${v.modelo} ${v.ano}${v.placa ? ' • ' + v.placa : ''}` : ''
          })()
        : ((form.get('veiculoLabel') as string) || '').trim()
    const tipo = (form.get('tipo') as string)?.trim()
    const descricao = (form.get('descricao') as string)?.trim()
    const oficina = (form.get('oficina') as string)?.trim()
    const responsavel = (form.get('responsavel') as string)?.trim()
    const custoNumber = parseMoney(custo) || 0
    const dataAgendada = (form.get('dataAgendada') as string) || ''
    const dataConclusao = (form.get('dataConclusao') as string) || ''
    const status = (form.get('status') as Status) || 'agendada'

    if (!veiculoLabel || !tipo || !oficina || !responsavel || !dataAgendada) {
      toast.error('Preencha os campos obrigatórios.')
      return
    }

    if (editing) {
      setItems((prev) =>
        prev.map((m) =>
          m.id === editing.id
            ? { ...m, veiculoId, veiculoLabel, tipo, descricao, oficina, responsavel, custo: custoNumber, dataAgendada, dataConclusao, status }
            : m,
        ),
      )
      toast.success('Manutenção atualizada.')
    } else {
      const novo: Manutencao = {
        id: genId(),
        veiculoId,
        veiculoLabel,
        tipo,
        descricao,
        oficina,
        responsavel,
        custo: custoNumber,
        dataAgendada,
        dataConclusao,
        status,
      }
      setItems((prev) => [novo, ...prev])
      toast.success('Manutenção cadastrada.')
    }
    closeForm()
  }

  function handleDelete(m: Manutencao) {
    setItems((prev) => prev.filter((x) => x.id !== m.id))
    toast.success('Manutenção removida.')
    setConfirmDelete(null)
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

  const totalCusto = useMemo(() => filtered.reduce((acc, m) => acc + (m.custo || 0), 0), [
    filtered,
  ])

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

      <div className="grid gap-4 sm:grid-cols-3">
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
            Concluídas
          </p>
          <p className="mt-1 text-2xl font-bold text-neutral-950">
            {items.filter((m) => m.status === 'concluida').length}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
            Custo (filtrado)
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

            <Input
              label="Ou digite um veículo *"
              name="veiculoLabel"
              defaultValue={editing?.veiculoId ? '' : editing?.veiculoLabel}
              placeholder="Veículo avulso / não cadastrado"
              leftIcon={<IconCar size={14} />}
            />

            <Select label="Tipo *" name="tipo" required defaultValue={editing?.tipo ?? ''}>
              <option value="" disabled>
                Selecione
              </option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>

            <Input
              label="Oficina *"
              name="oficina"
              required
              defaultValue={editing?.oficina}
              placeholder="Nome da oficina"
              leftIcon={<IconBuildingWarehouse size={14} />}
            />

            <Input
              label="Responsável *"
              name="responsavel"
              required
              defaultValue={editing?.responsavel}
              placeholder="Quem está acompanhando"
              leftIcon={<IconUser size={14} />}
            />

            <Input
              label="Custo (R$)"
              name="custo"
              type="text"
              inputMode="decimal"
              value={custo}
              onChange={(e) => setCusto(maskMoney(e.target.value))}
              placeholder="R$ 0,00"
              leftIcon={<IconCash size={14} />}
            />

            <Input
              label="Data agendada *"
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
              defaultValue={editing?.dataConclusao}
              leftIcon={<IconCalendar size={14} />}
            />

            <Select
              label="Status"
              name="status"
              defaultValue={editing?.status ?? 'agendada'}
              containerClassName="sm:col-span-2"
            >
              <option value="agendada">Agendada</option>
              <option value="em_execucao">Em execução</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </Select>

            <Textarea
              label="Descrição"
              name="descricao"
              rows={3}
              defaultValue={editing?.descricao}
              placeholder="Serviços a serem executados..."
              containerClassName="sm:col-span-2"
            />

            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={closeForm}>
                Cancelar
              </Button>
              <Button type="submit" variant="liberty">
                {editing ? 'Salvar Alterações' : 'Cadastrar'}
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
                <TH>Agendada</TH>
                <TH>Conclusão</TH>
                <TH align="right">Custo</TH>
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
                    <div>{m.oficina}</div>
                    <div className="text-xs text-neutral-500">{m.responsavel}</div>
                  </TD>
                  <TD className="text-xs">{formatDate(m.dataAgendada)}</TD>
                  <TD className="text-xs">{formatDate(m.dataConclusao)}</TD>
                  <TD align="right" className="font-semibold text-neutral-900">
                    {formatCurrency(m.custo)}
                  </TD>
                  <TD>
                    <StatusBadge tone={STATUS_TONE[m.status]}>{STATUS_LABELS[m.status]}</StatusBadge>
                  </TD>
                  <TD align="right">
                    <div className="inline-flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEdit(m)}
                        leftIcon={<IconPencil size={12} />}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setConfirmDelete(m)}
                        leftIcon={<IconTrash size={12} />}
                        className="!border-rose-200 !text-rose-600 hover:!bg-rose-50"
                      >
                        Remover
                      </Button>
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
    </div>
  )
}
