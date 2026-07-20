'use client'

import { useMemo, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'

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

const STATUS_STYLES: Record<Status, string> = {
  agendada: 'bg-blue-100 text-blue-800',
  em_execucao: 'bg-amber-100 text-amber-800',
  concluida: 'bg-emerald-100 text-emerald-800',
  cancelada: 'bg-neutral-200 text-neutral-700',
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

function genId() {
  return 'm-' + Math.random().toString(36).slice(2, 9)
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('pt-BR')
}

interface Props {
  currentRole: string
  veiculos: { id: string; marca: string; modelo: string; ano: number; placa: string | null }[]
}

export default function ManutencaoClient({ currentRole, veiculos }: Props) {
  const [items, setItems] = useState<Manutencao[]>(initialData)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Manutencao | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'todos' | Status>('todos')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Manutencao | null>(null)

  function openCreate() {
    setEditing(null)
    setShowForm(true)
    setMessage(null)
  }

  function openEdit(m: Manutencao) {
    setEditing(m)
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
    const custo = Number((form.get('custo') as string) || 0)
    const dataAgendada = (form.get('dataAgendada') as string) || ''
    const dataConclusao = (form.get('dataConclusao') as string) || ''
    const status = (form.get('status') as Status) || 'agendada'

    if (!veiculoLabel || !tipo || !oficina || !responsavel || !dataAgendada) {
      setMessage({ type: 'error', text: 'Preencha os campos obrigatórios.' })
      return
    }

    if (editing) {
      setItems((prev) =>
        prev.map((m) =>
          m.id === editing.id
            ? { ...m, veiculoId, veiculoLabel, tipo, descricao, oficina, responsavel, custo, dataAgendada, dataConclusao, status }
            : m
        )
      )
      setMessage({ type: 'success', text: 'Manutenção atualizada.' })
    } else {
      const novo: Manutencao = {
        id: genId(),
        veiculoId,
        veiculoLabel,
        tipo,
        descricao,
        oficina,
        responsavel,
        custo,
        dataAgendada,
        dataConclusao,
        status,
      }
      setItems((prev) => [novo, ...prev])
      setMessage({ type: 'success', text: 'Manutenção cadastrada.' })
    }
    closeForm()
  }

  function handleDelete(m: Manutencao) {
    setItems((prev) => prev.filter((x) => x.id !== m.id))
    setMessage({ type: 'success', text: 'Manutenção removida.' })
    setConfirmDelete(null)
  }

  const filtered = useMemo(() => {
    return items.filter((m) => {
      const matchesStatus = filterStatus === 'todos' || m.status === filterStatus
      const term = search.toLowerCase()
      const matchesSearch =
        !term ||
        m.veiculoLabel.toLowerCase().includes(term) ||
        m.tipo.toLowerCase().includes(term) ||
        m.oficina.toLowerCase().includes(term) ||
        m.responsavel.toLowerCase().includes(term)
      return matchesStatus && matchesSearch
    })
  }, [items, search, filterStatus])

  const totalCusto = useMemo(
    () => filtered.reduce((acc, m) => acc + (m.custo || 0), 0),
    [filtered]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Módulo de Manutenção</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Ordens de serviço, agendamentos e histórico de manutenções da frota.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Ordens abertas</p>
          <p className="mt-1 text-2xl font-bold text-neutral-950">
            {items.filter((m) => m.status === 'agendada' || m.status === 'em_execucao').length}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Concluídas</p>
          <p className="mt-1 text-2xl font-bold text-neutral-950">
            {items.filter((m) => m.status === 'concluida').length}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Custo (filtrado)</p>
          <p className="mt-1 text-2xl font-bold text-neutral-950">{formatCurrency(totalCusto)}</p>
        </div>
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
            placeholder="Buscar por veículo, oficina, tipo..."
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
            <option value="agendada">Agendada</option>
            <option value="em_execucao">Em execução</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-medium px-4 py-2.5 transition-colors shadow-xs cursor-pointer"
        >
          <IconPlus size={14} stroke={2.5} />
          Nova Manutenção
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-neutral-900 mb-5">
            {editing ? 'Editar Manutenção' : 'Cadastrar Manutenção'}
          </h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Veículo (cadastrado) *
              </label>
              <select
                name="veiculoId"
                defaultValue={editing?.veiculoId ?? ''}
                onChange={(e) => {
                  const id = e.currentTarget.value
                  const free = e.currentTarget.form?.elements.namedItem('veiculoLabel') as HTMLInputElement | null
                  if (free && id) free.value = ''
                }}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:border-neutral-900 focus:outline-hidden"
              >
                <option value="">— Selecionar do estoque —</option>
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} {v.ano} {v.placa ? `• ${v.placa}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Ou digite um veículo *
              </label>
              <input
                name="veiculoLabel"
                defaultValue={editing?.veiculoId ? '' : editing?.veiculoLabel}
                placeholder="Veículo avulso / não cadastrado"
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
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Oficina *</label>
              <input
                name="oficina"
                required
                defaultValue={editing?.oficina}
                placeholder="Nome da oficina"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Responsável *</label>
              <input
                name="responsavel"
                required
                defaultValue={editing?.responsavel}
                placeholder="Quem está acompanhando"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Custo (R$)</label>
              <input
                name="custo"
                type="number"
                min="0"
                step="0.01"
                defaultValue={editing?.custo ?? 0}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Data agendada *</label>
              <input
                name="dataAgendada"
                type="date"
                required
                defaultValue={editing?.dataAgendada}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Data conclusão</label>
              <input
                name="dataConclusao"
                type="date"
                defaultValue={editing?.dataConclusao}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Status</label>
              <select
                name="status"
                defaultValue={editing?.status ?? 'agendada'}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:border-neutral-900 focus:outline-hidden"
              >
                <option value="agendada">Agendada</option>
                <option value="em_execucao">Em execução</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Descrição</label>
              <textarea
                name="descricao"
                rows={3}
                defaultValue={editing?.descricao}
                placeholder="Serviços a serem executados..."
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
                <th className="px-4 py-3">Veículo / Tipo</th>
                <th className="px-4 py-3">Oficina / Resp.</th>
                <th className="px-4 py-3">Agendada</th>
                <th className="px-4 py-3">Conclusão</th>
                <th className="px-4 py-3">Custo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-neutral-400 font-medium">
                    Nenhuma manutenção encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-neutral-900">{m.veiculoLabel}</div>
                      <div className="text-xs text-neutral-500">{m.tipo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{m.oficina}</div>
                      <div className="text-xs text-neutral-500">{m.responsavel}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{formatDate(m.dataAgendada)}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(m.dataConclusao)}</td>
                    <td className="px-4 py-3 font-semibold text-neutral-900">{formatCurrency(m.custo)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[m.status]}`}>
                        {STATUS_LABELS[m.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => openEdit(m)}
                          className="rounded-lg border border-neutral-200 hover:bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(m)}
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

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-neutral-950">Remover manutenção?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Esta ação é local. Tem certeza que deseja remover a manutenção do veículo <strong>{confirmDelete.veiculoLabel}</strong>?
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
