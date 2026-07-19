'use client'

import { useMemo, useState } from 'react'

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

const STATUS_STYLES: Record<Status, string> = {
  em_andamento: 'bg-blue-100 text-blue-800',
  concluido: 'bg-emerald-100 text-emerald-800',
  pendente: 'bg-amber-100 text-amber-800',
  arquivado: 'bg-neutral-200 text-neutral-700',
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

function genId() {
  return 'p-' + Math.random().toString(36).slice(2, 9)
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('pt-BR')
}

export default function JuridicoClient({ currentRole }: { currentRole: string }) {
  const isAdmin = currentRole === 'admin'
  const [processos, setProcessos] = useState<Processo[]>(initialData)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Processo | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | Status>('todos')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Processo | null>(null)

  function openCreate() {
    setEditing(null)
    setShowForm(true)
    setMessage(null)
  }

  function openEdit(p: Processo) {
    setEditing(p)
    setShowForm(true)
    setMessage(null)
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
      setMessage({ type: 'error', text: 'Preencha os campos obrigatórios.' })
      return
    }

    if (editing) {
      setProcessos((prev) =>
        prev.map((p) =>
          p.id === editing.id
            ? { ...p, titulo, cliente, tipo, numero, status, responsavel, prazo, observacoes }
            : p
        )
      )
      setMessage({ type: 'success', text: 'Processo atualizado com sucesso.' })
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
      setMessage({ type: 'success', text: 'Processo cadastrado com sucesso.' })
    }
    closeForm()
  }

  function handleDelete(p: Processo) {
    setProcessos((prev) => prev.filter((x) => x.id !== p.id))
    setMessage({ type: 'success', text: 'Processo removido.' })
    setConfirmDelete(null)
  }

  const filtered = useMemo(() => {
    return processos.filter((p) => {
      const matchesStatus = filterStatus === 'todos' || p.status === filterStatus
      const term = search.toLowerCase()
      const matchesSearch =
        !term ||
        p.titulo.toLowerCase().includes(term) ||
        p.cliente.toLowerCase().includes(term) ||
        p.numero.toLowerCase().includes(term) ||
        p.responsavel.toLowerCase().includes(term)
      return matchesStatus && matchesSearch
    })
  }, [processos, search, filterStatus])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Módulo Jurídico</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Gestão de processos, contratos e documentos legais do grupo Liberty Car.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg p-4 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Buscar por título, cliente, número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors w-full sm:w-72"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'todos' | Status)}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:border-neutral-900 focus:outline-hidden transition-colors"
          >
            <option value="todos">Todos os status</option>
            <option value="em_andamento">Em andamento</option>
            <option value="pendente">Pendente</option>
            <option value="concluido">Concluído</option>
            <option value="arquivado">Arquivado</option>
          </select>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-medium px-4 py-2.5 transition-colors shadow-xs cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Novo Processo
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-neutral-900 mb-5">
            {editing ? 'Editar Processo' : 'Cadastrar Processo'}
          </h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Título *
              </label>
              <input
                name="titulo"
                required
                defaultValue={editing?.titulo}
                placeholder="Ex: Contrato - Cliente X"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Cliente *</label>
              <input
                name="cliente"
                required
                defaultValue={editing?.cliente}
                placeholder="Nome do cliente"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Tipo *</label>
              <select
                name="tipo"
                required
                defaultValue={editing?.tipo ?? ''}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:border-neutral-900 focus:outline-hidden"
              >
                <option value="" disabled>Selecione</option>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Número do processo</label>
              <input
                name="numero"
                defaultValue={editing?.numero}
                placeholder="0000000-00.0000"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Status</label>
              <select
                name="status"
                defaultValue={editing?.status ?? 'em_andamento'}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:border-neutral-900 focus:outline-hidden"
              >
                <option value="em_andamento">Em andamento</option>
                <option value="pendente">Pendente</option>
                <option value="concluido">Concluído</option>
                <option value="arquivado">Arquivado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Responsável *</label>
              <input
                name="responsavel"
                required
                defaultValue={editing?.responsavel}
                placeholder="Nome do advogado responsável"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Prazo</label>
              <input
                name="prazo"
                type="date"
                defaultValue={editing?.prazo}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Observações</label>
              <textarea
                name="observacoes"
                rows={3}
                defaultValue={editing?.observacoes}
                placeholder="Anotações internas, próximos passos..."
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden resize-none"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-neutral-200 hover:bg-neutral-100 px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-medium px-5 py-2 transition-colors shadow-xs cursor-pointer"
              >
                {editing ? 'Salvar Alterações' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-700 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3">Título / Cliente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Prazo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-neutral-400 font-medium">
                    Nenhum processo encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-neutral-900">{p.titulo}</div>
                      <div className="text-xs text-neutral-500">{p.cliente} • {p.numero || 's/ número'}</div>
                    </td>
                    <td className="px-4 py-3">{p.tipo}</td>
                    <td className="px-4 py-3">{p.responsavel}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(p.prazo)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded-lg border border-neutral-200 hover:bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(p)}
                          className="rounded-lg border border-rose-200 hover:bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 transition-colors cursor-pointer"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!isAdmin && (
        <p className="text-[11px] text-neutral-400">
          Você está logado como advogado. Apenas administradores podem cadastrar novos usuários no sistema.
        </p>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-neutral-950">Remover processo?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Esta ação é local e não pode ser desfeita. Tem certeza que deseja remover o processo <strong>{confirmDelete.titulo}</strong>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-neutral-200 hover:bg-neutral-100 px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 text-sm font-semibold transition-colors cursor-pointer"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
