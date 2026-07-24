'use client'

import { useMemo, useState } from 'react'
import {
  IconPlus,
  IconScale,
  IconPencil,
  IconTrash,
  IconCalendar,
  IconUser,
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

type Status = 'em_andamento' | 'concluido' | 'pendente' | 'arquivado'

interface Processo {
  id: string
  titulo: string
  cliente: string
  tipo: string
  numero: string
  status: Status
  responsavel: string
  prazo: string
  observacoes: string
  createdAt: string
}

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

const initialData: Processo[] = [
  {
    id: 'p-1',
    titulo: 'Contrato - João da Silva',
    cliente: 'João da Silva',
    tipo: 'Contrato de compra e venda',
    numero: '0001234-56.2025',
    status: 'em_andamento',
    responsavel: 'Dra. Marina Costa',
    prazo: '2026-08-15',
    observacoes: 'Aguardando assinatura do comprador.',
    createdAt: '2026-07-01',
  },
  {
    id: 'p-2',
    titulo: 'Transferência - Honda Civic 2023',
    cliente: 'Maria Oliveira',
    tipo: 'Transferência de propriedade',
    numero: 'INT-2026-045',
    status: 'pendente',
    responsavel: 'Dr. Rafael Lima',
    prazo: '2026-07-30',
    observacoes: 'Falta CRV original.',
    createdAt: '2026-07-05',
  },
]

const PAGE_SIZE = 12

function genId() {
  return 'p-' + Math.random().toString(36).slice(2, 9)
}

export default function JuridicoClient({ currentRole }: { currentRole: string }) {
  const isAdmin = currentRole === 'admin'
  const [processos, setProcessos] = useState<Processo[]>(initialData)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Processo | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | Status>('todos')
  const [confirmDelete, setConfirmDelete] = useState<Processo | null>(null)
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search, 250)
  const toast = useToast()

  function openCreate() {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(p: Processo) {
    setEditing(p)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const titulo = (form.get('titulo') as string)?.trim()
    const cliente = (form.get('cliente') as string)?.trim()
    const tipo = (form.get('tipo') as string)?.trim()
    const numero = (form.get('numero') as string)?.trim()
    const status = (form.get('status') as Status) || 'em_andamento'
    const responsavel = (form.get('responsavel') as string)?.trim()
    const prazo = (form.get('prazo') as string) || ''
    const observacoes = (form.get('observacoes') as string) || ''

    if (!titulo || !cliente || !tipo || !responsavel) {
      toast.error('Preencha os campos obrigatórios.')
      return
    }

    if (editing) {
      setProcessos((prev) =>
        prev.map((p) =>
          p.id === editing.id
            ? { ...p, titulo, cliente, tipo, numero, status, responsavel, prazo, observacoes }
            : p,
        ),
      )
      toast.success('Processo atualizado com sucesso.')
    } else {
      const novo: Processo = {
        id: genId(),
        titulo,
        cliente,
        tipo,
        numero,
        status,
        responsavel,
        prazo,
        observacoes,
        createdAt: new Date().toISOString().slice(0, 10),
      }
      setProcessos((prev) => [novo, ...prev])
      toast.success('Processo cadastrado com sucesso.')
    }
    closeForm()
  }

  function handleDelete(p: Processo) {
    setProcessos((prev) => prev.filter((x) => x.id !== p.id))
    toast.success('Processo removido.')
    setConfirmDelete(null)
  }

  const filtered = useMemo(() => {
    return processos.filter((p) => {
      const matchesStatus = filterStatus === 'todos' || p.status === filterStatus
      const term = debouncedSearch.toLowerCase()
      const matchesSearch =
        !term ||
        p.titulo.toLowerCase().includes(term) ||
        p.cliente.toLowerCase().includes(term) ||
        p.numero.toLowerCase().includes(term) ||
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
              label="Título *"
              name="titulo"
              required
              defaultValue={editing?.titulo}
              placeholder="Ex: Contrato - Cliente X"
              containerClassName="sm:col-span-2"
            />

            <Input
              label="Cliente *"
              name="cliente"
              required
              defaultValue={editing?.cliente}
              placeholder="Nome do cliente"
              autoComplete="name"
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
              label="Número do processo"
              name="numero"
              defaultValue={editing?.numero}
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
              label="Responsável *"
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
              defaultValue={editing?.prazo}
              leftIcon={<IconCalendar size={14} />}
            />

            <Textarea
              label="Observações"
              name="observacoes"
              rows={3}
              defaultValue={editing?.observacoes}
              placeholder="Anotações internas, próximos passos..."
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
                  </TD>
                  <TD>{p.tipo}</TD>
                  <TD>{p.responsavel}</TD>
                  <TD className="text-xs">{formatDate(p.prazo)}</TD>
                  <TD>
                    <StatusBadge tone={STATUS_TONE[p.status]}>
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
