'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  IconPlus,
  IconFileDownload,
  IconTrash,
  IconFileText,
  IconBriefcase,
} from '@tabler/icons-react'
import type { Contrato, ContratoInput } from './types'
import { criarContrato, removerContrato } from './actions'
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
  ConfirmDialog,
  Breadcrumb,
  useToast,
} from '@/app/components/ui'
import { useDebounce } from '@/utils/useDebounce'
import { formatCurrency, formatDate } from '@/utils/format'
import { maskMoney, parseMoney } from '@/utils/masks'

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

const PAGE_SIZE = 20

export default function ContratosClient({
  initialContratos,
  veiculos,
}: ContratosClientProps) {
  const [contratos, setContratos] = useState<Contrato[]>(initialContratos)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState<Contrato | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search, 250)

  const [selectedVeiculoId, setSelectedVeiculoId] = useState('')
  const [valor, setValor] = useState('')
  const [clienteCpfCnpj, setClienteCpfCnpj] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const toast = useToast()

  function handleVeiculoChange(id: string) {
    setSelectedVeiculoId(id)
    const v = veiculos.find((x) => x.id === id)
    if (v && v.preco > 0) {
      setValor(maskMoney(v.preco.toString()))
    }
  }

  function resetForm() {
    setSelectedVeiculoId('')
    setValor('')
    setClienteCpfCnpj('')
    setClienteTelefone('')
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)

    const input: ContratoInput = {
      veiculoId: selectedVeiculoId,
      clienteNome: (form.get('clienteNome') as string)?.trim(),
      clienteCpfCnpj: (clienteCpfCnpj || (form.get('clienteCpfCnpj') as string))?.trim(),
      clienteEndereco: (form.get('clienteEndereco') as string)?.trim(),
      clienteEmail: (form.get('clienteEmail') as string)?.trim() || null,
      clienteTelefone: (clienteTelefone || (form.get('clienteTelefone') as string))?.trim() || null,
      valor: parseMoney(valor) || Number(valor) || 0,
      formaPagamento: (form.get('formaPagamento') as string)?.trim() || 'À vista',
      clausulasExtras: (form.get('clausulasExtras') as string)?.trim() || '',
      observacoesInternas: (form.get('observacoesInternas') as string)?.trim() || '',
    }

    startTransition(async () => {
      const res = await criarContrato(input)
      if (res.error) {
        toast.error(res.error)
      } else if (res.contrato) {
        toast.success('Contrato gerado e salvo com sucesso!')
        setContratos((prev) => [res.contrato!, ...prev])
        setShowForm(false)
        resetForm()
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await removerContrato(id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Contrato removido com sucesso.')
        setContratos((prev) => prev.filter((c) => c.id !== id))
        setConfirmDelete(null)
      }
    })
  }

  const filtered = useMemo(() => {
    const term = debouncedSearch.toLowerCase()
    if (!term) return contratos
    return contratos.filter(
      (c) =>
        c.clienteNome.toLowerCase().includes(term) ||
        c.clienteCpfCnpj.toLowerCase().includes(term) ||
        c.veiculoResumo.toLowerCase().includes(term) ||
        c.id.toLowerCase().includes(term),
    )
  }, [contratos, debouncedSearch])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const visible = filtered.slice(start, start + PAGE_SIZE)
  const fromItem = filtered.length === 0 ? 0 : start + 1
  const toItem = Math.min(start + PAGE_SIZE, filtered.length)

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Contratos' }]}
      />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Gestão de Contratos</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Gere, visualize e faça o download dos contratos de compra e venda de veículos.
          </p>
        </div>

        <Button
          variant="liberty"
          onClick={() => setShowForm((v) => !v)}
          leftIcon={<IconPlus size={16} stroke={2.5} />}
          className="self-start sm:self-auto"
        >
          {showForm ? 'Fechar Formulário' : 'Novo Contrato'}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-neutral-900 mb-5 flex items-center gap-2">
            <IconFileText size={20} className="text-liberty-deep" />
            Gerar Novo Contrato de Venda
          </h2>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Select
                label="Veículo *"
                required
                value={selectedVeiculoId}
                onChange={(e) => handleVeiculoChange(e.target.value)}
              >
                <option value="" disabled>
                  Selecione o veículo comercializado
                </option>
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} ({v.ano ?? 'N/A'}) - {v.placa ? `Placa ${v.placa}` : 'Sem placa'} - {formatCurrency(v.preco)}
                  </option>
                ))}
              </Select>
            </div>

            <Input
              label="Nome do Comprador *"
              name="clienteNome"
              required
              autoComplete="name"
              placeholder="Ex: João da Silva"
              containerClassName="sm:col-span-1"
            />

            <Input
              label="CPF / CNPJ *"
              name="clienteCpfCnpj"
              required
              value={clienteCpfCnpj}
              onChange={(e) => setClienteCpfCnpj(e.target.value)}
              autoComplete="off"
              inputMode="numeric"
              placeholder="000.000.000-00"
              mask="cpfCnpj"
            />

            <Input
              label="Endereço Completo *"
              name="clienteEndereco"
              required
              autoComplete="street-address"
              placeholder="Rua, Número, Bairro, Cidade - UF"
              containerClassName="sm:col-span-2"
            />

            <Input
              label="E-mail do Cliente"
              name="clienteEmail"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="cliente@email.com"
            />

            <Input
              label="Telefone / WhatsApp"
              name="clienteTelefone"
              value={clienteTelefone}
              onChange={(e) => setClienteTelefone(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
              placeholder="(00) 00000-0000"
              mask="phone"
            />

            <Input
              label="Valor Total (R$) *"
              type="text"
              inputMode="decimal"
              required
              value={valor}
              onChange={(e) => setValor(maskMoney(e.target.value))}
              placeholder="R$ 0,00"
            />

            <Input
              label="Forma de Pagamento *"
              name="formaPagamento"
              required
              defaultValue="À vista via Pix / Transferência"
              placeholder="Ex: Financiamento 36x, À vista..."
            />

            <Textarea
              label="Cláusulas Extras / Observações do Contrato"
              name="clausulasExtras"
              rows={3}
              placeholder="Insira detalhes específicos de garantias, trocas ou condições acertadas..."
              containerClassName="sm:col-span-2"
            />

            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="liberty"
                loading={isPending}
                loadingLabel="Gerando PDF..."
                leftIcon={<IconBriefcase size={16} />}
              >
                Gerar e Emitir Contrato PDF
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Buscar por cliente, CPF ou veículo..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          containerClassName="w-full sm:max-w-sm"
        />
        <div className="text-xs text-neutral-500 hidden sm:block whitespace-nowrap">
          {filtered.length === 0
            ? '0 contratos'
            : `Mostrando ${fromItem}–${toItem} de ${filtered.length}`}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<IconFileText size={24} />}
          title={search ? 'Nenhum contrato encontrado' : 'Nenhum contrato cadastrado'}
          description={
            search
              ? 'Tente ajustar a busca para localizar contratos.'
              : 'Comece gerando o primeiro contrato de venda.'
          }
        />
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
          <Table>
            <THead>
              <tr>
                <TH>Cliente / CPF</TH>
                <TH>Veículo</TH>
                <TH align="right">Valor</TH>
                <TH>Data de Emissão</TH>
                <TH align="right">Ações</TH>
              </tr>
            </THead>
            <TBody>
              {visible.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <div className="font-semibold text-neutral-900">{c.clienteNome}</div>
                    <div className="text-xs text-neutral-500">{c.clienteCpfCnpj}</div>
                  </TD>
                  <TD className="font-medium text-neutral-800">{c.veiculoResumo}</TD>
                  <TD align="right" className="font-bold text-neutral-900">
                    {formatCurrency(c.valor)}
                  </TD>
                  <TD className="text-xs">{formatDate(c.criadoEm)}</TD>
                  <TD align="right">
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
                        type="button"
                        onClick={() => setConfirmDelete(c)}
                        aria-label={`Excluir contrato de ${c.clienteNome}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 hover:bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors cursor-pointer"
                      >
                        <IconTrash size={14} />
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

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.id)}
        title="Excluir contrato?"
        description={
          confirmDelete ? (
            <>
              Tem certeza que deseja excluir o contrato do cliente{' '}
              <strong>{confirmDelete.clienteNome}</strong>? Esta ação removerá também o PDF
              gravado.
            </>
          ) : null
        }
        confirmLabel={isPending ? 'Excluindo...' : 'Excluir'}
        tone="danger"
        loading={isPending}
      />
    </div>
  )
}
