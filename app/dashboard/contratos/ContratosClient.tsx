'use client'

import { useState, useTransition } from 'react'
import { IconPlus, IconFileDownload, IconTrash, IconFileText } from '@tabler/icons-react'
import type { Contrato, ContratoInput } from './types'
import { criarContrato, removerContrato } from './actions'

interface VeiculoOption {
  id: string
  marca: string
  modelo: string
  ano: number | null
  placa: string
  preco: number
}

interface ContratosClientProps {
  initialContratos: Contrato[]
  veiculos: VeiculoOption[]
  userRole: string | null
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR')
}

export default function ContratosClient({
  initialContratos,
  veiculos,
}: ContratosClientProps) {
  const [contratos, setContratos] = useState<Contrato[]>(initialContratos)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Contrato | null>(null)
  const [search, setSearch] = useState('')

  const [selectedVeiculoId, setSelectedVeiculoId] = useState('')
  const [valor, setValor] = useState('')

  function handleVeiculoChange(id: string) {
    setSelectedVeiculoId(id)
    const v = veiculos.find((x) => x.id === id)
    if (v && v.preco > 0) {
      setValor(v.preco.toString())
    }
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)
    const form = new FormData(e.currentTarget)

    const input: ContratoInput = {
      veiculoId: selectedVeiculoId,
      clienteNome: (form.get('clienteNome') as string)?.trim(),
      clienteCpfCnpj: (form.get('clienteCpfCnpj') as string)?.trim(),
      clienteEndereco: (form.get('clienteEndereco') as string)?.trim(),
      clienteEmail: (form.get('clienteEmail') as string)?.trim() || null,
      clienteTelefone: (form.get('clienteTelefone') as string)?.trim() || null,
      valor: Number(valor) || 0,
      formaPagamento: (form.get('formaPagamento') as string)?.trim() || 'À vista',
      clausulasExtras: (form.get('clausulasExtras') as string)?.trim() || '',
      observacoesInternas: (form.get('observacoesInternas') as string)?.trim() || '',
    }

    startTransition(async () => {
      const res = await criarContrato(input)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else if (res.contrato) {
        setMessage({ type: 'success', text: 'Contrato gerado e salvo com sucesso!' })
        setContratos((prev) => [res.contrato!, ...prev])
        setShowForm(false)
        setSelectedVeiculoId('')
        setValor('')
      }
    })
  }

  function handleDelete(id: string) {
    setMessage(null)
    startTransition(async () => {
      const res = await removerContrato(id)
      if (res.error) {
        setMessage({ type: 'error', text: res.error })
      } else {
        setMessage({ type: 'success', text: 'Contrato removido com sucesso.' })
        setContratos((prev) => prev.filter((c) => c.id !== id))
        setConfirmDelete(null)
      }
    })
  }

  const filtered = contratos.filter((c) => {
    const term = search.toLowerCase()
    return (
      !term ||
      c.clienteNome.toLowerCase().includes(term) ||
      c.clienteCpfCnpj.toLowerCase().includes(term) ||
      c.veiculoResumo.toLowerCase().includes(term) ||
      c.id.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Gestão de Contratos</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Gere, visualize e faça o download dos contratos de compra e venda de veículos.
          </p>
        </div>

        <button
          onClick={() => {
            setShowForm((v) => !v)
            setMessage(null)
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-medium px-4 py-2.5 transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <IconPlus size={16} stroke={2.5} />
          {showForm ? 'Fechar Formulário' : 'Novo Contrato'}
        </button>
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

      {showForm && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-neutral-900 mb-5 flex items-center gap-2">
            <IconFileText size={20} className="text-neutral-700" />
            Gerar Novo Contrato de Venda
          </h2>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Veículo *
              </label>
              <select
                required
                value={selectedVeiculoId}
                onChange={(e) => handleVeiculoChange(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:border-neutral-900 focus:outline-hidden"
              >
                <option value="" disabled>
                  Selecione o veículo comercializado
                </option>
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} ({v.ano ?? 'N/A'}) - {v.placa ? `Placa ${v.placa}` : 'Sem placa'} - {formatCurrency(v.preco)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Nome do Comprador *
              </label>
              <input
                name="clienteNome"
                required
                placeholder="Ex: João da Silva"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                CPF / CNPJ *
              </label>
              <input
                name="clienteCpfCnpj"
                required
                placeholder="000.000.000-00"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Endereço Completo *
              </label>
              <input
                name="clienteEndereco"
                required
                placeholder="Rua, Número, Bairro, Cidade - UF"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                E-mail do Cliente
              </label>
              <input
                name="clienteEmail"
                type="email"
                placeholder="cliente@email.com"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Telefone / WhatsApp
              </label>
              <input
                name="clienteTelefone"
                placeholder="(00) 00000-0000"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Valor Total (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Forma de Pagamento *
              </label>
              <input
                name="formaPagamento"
                required
                defaultValue="À vista via Pix / Transferência"
                placeholder="Ex: Financiamento 36x, À vista..."
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Cláusulas Extras / Observações do Contrato
              </label>
              <textarea
                name="clausulasExtras"
                rows={3}
                placeholder="Insira detalhes específicos de garantias, trocas ou condições acertadas..."
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden resize-none"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-neutral-200 hover:bg-neutral-100 px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-medium px-5 py-2 transition-colors shadow-xs cursor-pointer disabled:opacity-60"
              >
                {isPending ? 'Gerando PDF...' : 'Gerar e Emitir Contrato PDF'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder="Buscar por cliente, CPF ou veículo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-hidden transition-colors w-full sm:w-80"
        />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-700 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3">Cliente / CPF</th>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Data de Emissão</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-neutral-400 font-medium">
                    Nenhum contrato cadastrado.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-neutral-900">{c.clienteNome}</div>
                      <div className="text-xs text-neutral-500">{c.clienteCpfCnpj}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-800">{c.veiculoResumo}</td>
                    <td className="px-4 py-3 font-bold text-neutral-900">{formatCurrency(c.valor)}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(c.criadoEm)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <a
                          href={`/api/contratos/${c.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 hover:bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
                        >
                          <IconFileDownload size={14} />
                          Ver PDF
                        </a>
                        <button
                          onClick={() => setConfirmDelete(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 hover:bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors cursor-pointer"
                        >
                          <IconTrash size={14} />
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
            <h3 className="text-lg font-bold text-neutral-950">Excluir contrato?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Tem certeza que deseja excluir o contrato do cliente <strong>{confirmDelete.clienteNome}</strong>? Esta ação removerá também o PDF gravado.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-neutral-200 hover:bg-neutral-100 px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                disabled={isPending}
                className="rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
              >
                {isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
