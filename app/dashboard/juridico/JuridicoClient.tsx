'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconPlus,
  IconScale,
  IconPencil,
  IconTrash,
  IconCalendar,
  IconUser,
  IconCar,
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
import { formatDate } from '@/utils/format'
import type { BadgeTone } from '@/app/components/ui/StatusBadge'
import { createProcesso, updateProcesso, deleteProcesso } from './actions'
import type { Processo, ProcessoStatus } from './types'
import type { Veiculo } from '@/app/dashboard/veiculos/actions'
import { VeiculoPicker } from './VeiculoPicker'

type Status = ProcessoStatus

const STATUS_LABELS: Record<Status, string> = {
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  pendente: 'Pendente',
  arquivado: 'Arquivado',
}

const STATUS_TONE: Record<Status, BadgeTone> = {
  em_andamento: 'info',
  concluido: 'success',
  pendente: 'warning',
  arquivado: 'neutral',
}

const TIPOS = [
  'Contrato de compra e venda',
  'Financiamento',
  'Transferência de propriedade',
  'Ação judicial',
  'Assessoria contratual',
  'Outro',
]

const PAGE_SIZE = 12

export default function JuridicoClient({
  currentRole,
  initialProcessos,
  veiculos,
  clientesPorVeiculo,
}: {
  currentRole: string
  initialProcessos: Processo[]
  veiculos: Veiculo[]
  clientesPorVeiculo: Record<string, string>
}) {
  const router = useRouter()
  const isAdmin = currentRole === 'admin'
  const [processos, setProcessos] = useState<Processo[]>(initialProcessos)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Processo | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | Status>('todos')
  const [confirmDelete, setConfirmDelete] = useState<Processo | null>(null)
  const [page, setPage] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const debouncedSearch = useDebounce(search, 250)
  const toast = useToast()

  // Veículo vinculado ao processo (opcional) — ao selecionar, tenta
  // preencher automaticamente o campo "Cliente" a partir do contrato do
  // veículo, quando existir.
  const [showVeiculoPicker, setShowVeiculoPicker] = useState(false)
  const [formVeiculoId, setFormVeiculoId] = useState('')
  const [formVeiculoResumo, setFormVeiculoResumo] = useState('')
  const [formCliente, setFormCliente] = useState('')
  const [formTitulo, setFormTitulo] = useState('')

  function openCreate() {
    setEditing(null)
    setFormVeiculoId('')
    setFormVeiculoResumo('')
    setFormCliente('')
    setFormTitulo('')
    setShowForm(true)
  }

  function openEdit(p: Processo) {
    setEditing(p)
    setFormVeiculoId(p.veiculoId ?? '')
    setFormVeiculoResumo(p.veiculoResumo ?? '')
    setFormCliente(p.cliente)
    setFormTitulo(p.titulo)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  const handleSelectVeiculo = useCallback(
    (id: string) => {
      const v = veiculos.find((x) => x.id === id)
      const nomeVeiculo = v ? `${v.marca} ${v.modelo}${v.ano ? ` ${v.ano}` : ''}` : ''
      const resumo = v ? `${nomeVeiculo}${v.placa ? ` • ${v.placa}` : ''}` : ''
      setFormVeiculoId(id)
      setFormVeiculoResumo(resumo)
      if (nomeVeiculo) setFormTitulo(nomeVeiculo)

      const nome = clientesPorVeiculo[id]
      if (nome) {
        setFormCliente(nome)
        toast.success(`Cliente preenchido a partir do contrato: ${nome}`)
      }
    },
    [veiculos, clientesPorVeiculo, toast],
  )

  const handleRemoverVeiculo = useCallback(() => {
    setFormVeiculoId('')
    setFormVeiculoResumo('')
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)

    const form = new FormData(e.currentTarget)
    const titulo = (form.get('titulo') as string)?.trim()
    const cliente = (form.get('cliente') as string)?.trim()
    const tipo = (form.get('tipo') as string)?.trim()
    const responsavel = (form.get('responsavel') as string)?.trim()

    if (!titulo || !cliente || !tipo || !responsavel) {
      toast.error('Preencha os campos obrigatórios.')
      setSubmitting(false)
      return
    }

    try {
      const result = editing
        ? await updateProcesso(editing.id, form)
        : await createProcesso(form)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(result.success || (editing ? 'Processo atualizado.' : 'Processo cadastrado.'))
      router.refresh()
      closeForm()
    } catch (err: any) {
      toast.error(err?.message || 'Erro inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(p: Processo) {
    if (submitting) return
    setSubmitting(true)
    const target = p
    setConfirmDelete(null)

    setProcessos((prev) => prev.filter((x) => x.id !== target.id))

    try {
      const result = await deleteProcesso(target.id)
      if (result.error) {
        toast.error(result.error)
        router.refresh()
      } else {
        toast.success(result.success || 'Processo removido.')
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover.')
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = useMemo(() => {
    return processos.filter((p) => {
      const matchesStatus = filterStatus === 'todos' || p.status === filterStatus
      const term = debouncedSearch.toLowerCase()
      const matchesSearch =
        !term ||
        p.titulo.toLowerCase().includes(term) ||
        p.cliente.toLowerCase().includes(term) ||
        (p.numero || '').toLowerCase().includes(term) ||
        p.responsavel.toLowerCase().includes(term)
      return matchesStatus && matchesSearch
    })
  }, [processos, debouncedSearch, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const visible = filtered.slice(start, start + PAGE_SIZE)
  const fromItem = filtered.length === 0 ? 0 : start + 1
  const toItem = Math.min(start + PAGE_SIZE, filtered.length)

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Jurídico' }]}
      />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Módulo Jurídico</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Gestão de processos, contratos e documentos legais do grupo Liberty Car.
          </p>
        </div>

        <Button
          variant="liberty"
          onClick={openCreate}
          leftIcon={<IconPlus size={16} stroke={2.5} />}
          className="self-start sm:self-auto"
        >
          Novo Processo
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Buscar por título, cliente, número..."
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
            <option value="em_andamento">Em andamento</option>
            <option value="pendente">Pendente</option>
            <option value="concluido">Concluído</option>
            <option value="arquivado">Arquivado</option>
          </Select>
        </div>

        <div className="text-xs text-neutral-500 hidden sm:block whitespace-nowrap">
          {filtered.length === 0
            ? '0 processos'
            : `Mostrando ${fromItem}–${toItem} de ${filtered.length}`}
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-neutral-900 mb-5 flex items-center gap-2">
            <IconScale size={20} className="text-liberty-deep" />
            {editing ? 'Editar Processo' : 'Cadastrar Processo'}
          </h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Título"
              name="titulo"
              required
              value={formTitulo}
              onChange={(e) => setFormTitulo(e.target.value)}
              placeholder="Ex: Contrato - Cliente X"
              containerClassName="sm:col-span-2"
            />

            <Input
              label="Cliente"
              name="cliente"
              required
              value={formCliente}
              onChange={(e) => setFormCliente(e.target.value)}
              placeholder="Nome do cliente"
              autoComplete="name"
            />

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-neutral-700">
                Veículo vinculado
              </label>
              {formVeiculoId ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <IconCar size={16} className="shrink-0 text-liberty-deep" />
                    <span className="truncate text-sm font-medium text-neutral-800">
                      {formVeiculoResumo}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowVeiculoPicker(true)}
                      className="text-xs font-semibold text-liberty-deep hover:underline cursor-pointer"
                    >
                      Trocar
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoverVeiculo}
                      className="text-xs font-semibold text-neutral-400 hover:text-rose-600 cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowVeiculoPicker(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-2.5 text-xs font-semibold text-neutral-500 transition-colors hover:border-liberty/40 hover:text-liberty-deep cursor-pointer"
                >
                  <IconCar size={14} stroke={2} />
                  Selecionar veículo (opcional)
                </button>
              )}
              <p className="mt-1 text-[11px] text-neutral-400">
                Ao selecionar, o nome do cliente é preenchido automaticamente se houver contrato vinculado.
              </p>
              <input type="hidden" name="veiculoId" value={formVeiculoId} />
              <input type="hidden" name="veiculoResumo" value={formVeiculoResumo} />
            </div>

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
              label="Número do processo"
              name="numero"
              defaultValue={editing?.numero ?? ''}
              placeholder="0000000-00.0000"
            />

            <Select
              label="Status"
              name="status"
              defaultValue={editing?.status ?? 'em_andamento'}
            >
              <option value="em_andamento">Em andamento</option>
              <option value="pendente">Pendente</option>
              <option value="concluido">Concluído</option>
              <option value="arquivado">Arquivado</option>
            </Select>

            <Input
              label="Responsável"
              name="responsavel"
              required
              defaultValue={editing?.responsavel}
              placeholder="Nome do advogado responsável"
              leftIcon={<IconUser size={14} />}
            />

            <Input
              label="Prazo"
              name="prazo"
              type="date"
              defaultValue={editing?.prazo ?? ''}
              leftIcon={<IconCalendar size={14} />}
            />

            <Textarea
              label="Observações"
              name="observacoes"
              rows={3}
              defaultValue={editing?.observacoes ?? ''}
              placeholder="Anotações internas, próximos passos..."
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

      <VeiculoPicker
        open={showVeiculoPicker}
        onClose={() => setShowVeiculoPicker(false)}
        veiculos={veiculos.map((v) => ({
          id: v.id,
          marca: v.marca,
          modelo: v.modelo,
          ano: v.ano ?? null,
          placa: v.placa ?? null,
          cliente: clientesPorVeiculo[v.id] ?? null,
        }))}
        value={formVeiculoId || null}
        onSelect={handleSelectVeiculo}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<IconScale size={24} />}
          title="Nenhum processo encontrado"
          description="Ajuste os filtros ou cadastre um novo processo jurídico."
        />
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
          <Table>
            <THead>
              <tr>
                <TH>Título / Cliente</TH>
                <TH>Tipo</TH>
                <TH>Responsável</TH>
                <TH>Prazo</TH>
                <TH>Status</TH>
                <TH align="right">Ações</TH>
              </tr>
            </THead>
            <TBody>
              {visible.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <div className="font-semibold text-neutral-900">{p.titulo}</div>
                    <div className="text-xs text-neutral-500">
                      {p.cliente} • {p.numero || 's/ número'}
                    </div>
                    {p.veiculoResumo && (
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-400">
                        <IconCar size={11} stroke={2} />
                        {p.veiculoResumo}
                      </div>
                    )}
                  </TD>
                  <TD>{p.tipo}</TD>
                  <TD>{p.responsavel}</TD>
                  <TD className="text-xs">{formatDate(p.prazo)}</TD>
                  <TD>
                    <StatusBadge tone={STATUS_TONE[p.status]} className="whitespace-nowrap">
                      {STATUS_LABELS[p.status]}
                    </StatusBadge>
                  </TD>
                  <TD align="right">
                    <div className="inline-flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEdit(p)}
                        leftIcon={<IconPencil size={12} />}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setConfirmDelete(p)}
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

      {!isAdmin && (
        <p className="text-[11px] text-neutral-400">
          Você está logado como advogado. Apenas administradores podem cadastrar novos usuários no sistema.
        </p>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Remover processo?"
        description={
          confirmDelete ? (
            <>
              Esta ação é local e não pode ser desfeita. Tem certeza que deseja remover o
              processo <strong>{confirmDelete.titulo}</strong>?
            </>
          ) : null
        }
        confirmLabel="Remover"
        tone="danger"
      />
    </div>
  )
}
