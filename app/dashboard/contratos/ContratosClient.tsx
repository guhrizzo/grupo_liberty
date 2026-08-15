'use client'

import Link from 'next/link'
import { useState, useTransition, useMemo } from 'react'
import {
  IconPlus,
  IconFileDownload,
  IconTrash,
  IconFileText,
  IconBriefcase,
  IconUpload,
  IconFiles,
  IconEye,
} from '@tabler/icons-react'
import type { Contrato, ContratoInput } from './types'
import { criarContrato } from './actions'
import {
  anexarContratoVeiculoAction,
  removerContratoVeiculoAction,
} from '@/app/veiculos/[id]/actions'
import {
  Button,
  Input,
  Textarea,
  Select,
  Modal,
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
  preco: number | null
}

interface VeiculoAgrupado {
  veiculoId: string
  veiculoResumo: string
  veiculoMarca: string
  veiculoModelo: string
  veiculoAno: number | null
  veiculoPlaca: string | null
  contratos: Contrato[]
  ultimaData: string
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
  const [veiculoFiltro, setVeiculoFiltro] = useState<string>('')
  const debouncedSearch = useDebounce(search, 250)

  const [selectedVeiculoId, setSelectedVeiculoId] = useState('')
  const [verContratosVeiculoId, setVerContratosVeiculoId] = useState<string | null>(null)
  const [valor, setValor] = useState('')
  const [clienteCpfCnpj, setClienteCpfCnpj] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')

  const [anexarModalOpen, setAnexarModalOpen] = useState(false)
  const [isUploading, startUpload] = useTransition()
  const toast = useToast()

  function handleAnexarSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    if (!selectedVeiculoId) {
      toast.error('Selecione um veículo.')
      return
    }
    formData.set('veiculoId', selectedVeiculoId)

    const file = formData.get('pdf') as File | null
    if (!file || file.size === 0) {
      toast.error('Selecione um arquivo PDF.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo excede o limite de 10MB.')
      return
    }
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      toast.error('Apenas arquivos PDF são permitidos.')
      return
    }

    startUpload(async () => {
      const res = await anexarContratoVeiculoAction(formData)
      if (res.error) {
        toast.error(res.error)
        return
      }
      if (res.contrato) {
        toast.success('Contrato anexado ao veículo com sucesso!')
        const v = veiculos.find((x) => x.id === selectedVeiculoId)
        const novoContrato: Contrato = {
          id: res.contrato.id,
          veiculoId: res.contrato.veiculoId,
          veiculoResumo: v ? `${v.marca} ${v.modelo} (${v.ano ?? 'N/A'})` : res.contrato.fileName,
          veiculoMarca: v?.marca ?? '',
          veiculoModelo: v?.modelo ?? '',
          veiculoAno: v?.ano ?? null,
          veiculoPlaca: v?.placa ?? null,
          veiculoChassi: null,
          veiculoCor: null,
          veiculoQuilometragem: null,
          veiculoLocalizacao: null,
          clienteNome: res.contrato.descricao || res.contrato.fileName,
          clienteCpfCnpj: '',
          clienteEndereco: '',
          clienteEmail: res.contrato.uploadedByEmail,
          clienteTelefone: null,
          valor: 0,
          formaPagamento: '',
          dataEmissao: res.contrato.uploadedAt.slice(0, 10),
          clausulasExtras: res.contrato.descricao ?? '',
          observacoesInternas: '',
          status: 'ativo',
          storagePath: res.contrato.storagePath,
          criadoPorUid: res.contrato.uploadedByUid,
          criadoPorEmail: res.contrato.uploadedByEmail,
          criadoEm: res.contrato.uploadedAt,
          atualizadoEm: res.contrato.uploadedAt,
        }
        setContratos((prev) => [novoContrato, ...prev])
        setAnexarModalOpen(false)
        setSelectedVeiculoId('')
        form.reset()
      }
    })
  }

  function handleVeiculoChange(id: string) {
    setSelectedVeiculoId(id)
    const v = veiculos.find((x) => x.id === id)
    if (v && v.preco && v.preco > 0) {
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
    const target = contratos.find((c) => c.id === id)
    if (!target) {
      toast.error('Contrato não encontrado na listagem atual.')
      return
    }
    startTransition(async () => {
      const formData = new FormData()
      formData.set('veiculoId', target.veiculoId)
      formData.set('contratoId', target.id)
      const res = await removerContratoVeiculoAction(formData)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Contrato removido com sucesso.')
        setContratos((prev) => prev.filter((c) => c.id !== id))
        setConfirmDelete(null)
      }
    })
  }

  // Agrupa contratos por veículo
  const veiculosAgrupados = useMemo(() => {
    const map = new Map<string, VeiculoAgrupado>()

    for (const c of contratos) {
      if (!map.has(c.veiculoId)) {
        map.set(c.veiculoId, {
          veiculoId: c.veiculoId,
          veiculoResumo: c.veiculoResumo,
          veiculoMarca: c.veiculoMarca,
          veiculoModelo: c.veiculoModelo,
          veiculoAno: c.veiculoAno,
          veiculoPlaca: c.veiculoPlaca,
          contratos: [],
          ultimaData: c.criadoEm || c.dataEmissao || '',
        })
      }
      const item = map.get(c.veiculoId)!
      item.contratos.push(c)
      if ((c.criadoEm || c.dataEmissao) > item.ultimaData) {
        item.ultimaData = c.criadoEm || c.dataEmissao
      }
    }

    return Array.from(map.values())
  }, [contratos])

  // Filtra veículos agrupados por busca e por veículo selecionado
  const filteredAgrupados = useMemo(() => {
    const term = debouncedSearch.toLowerCase()
    return veiculosAgrupados.filter((group) => {
      if (veiculoFiltro && group.veiculoId !== veiculoFiltro) return false
      if (!term) return true

      const matchesVehicle = group.veiculoResumo.toLowerCase().includes(term)
      const matchesContract = group.contratos.some(
        (c) =>
          c.clienteNome.toLowerCase().includes(term) ||
          c.id.toLowerCase().includes(term) ||
          (c.clausulasExtras && c.clausulasExtras.toLowerCase().includes(term)) ||
          (c.criadoPorEmail && c.criadoPorEmail.toLowerCase().includes(term))
      )
      return matchesVehicle || matchesContract
    })
  }, [veiculosAgrupados, debouncedSearch, veiculoFiltro])

  const activeGroup = useMemo(() => {
    if (!verContratosVeiculoId) return null
    return veiculosAgrupados.find((g) => g.veiculoId === verContratosVeiculoId) || null
  }, [veiculosAgrupados, verContratosVeiculoId])

  const totalPages = Math.max(1, Math.ceil(filteredAgrupados.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const visible = filteredAgrupados.slice(start, start + PAGE_SIZE)
  const fromItem = filteredAgrupados.length === 0 ? 0 : start + 1
  const toItem = Math.min(start + PAGE_SIZE, filteredAgrupados.length)

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Contratos' }]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Gestão de Contratos</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Visualize, faça o download e adicione novos contratos aos veículos da frota.
          </p>
        </div>

        <Button
          variant="liberty"
          leftIcon={<IconUpload size={16} stroke={2.5} />}
          onClick={() => {
            setSelectedVeiculoId('')
            setAnexarModalOpen(true)
          }}
        >
          Anexar Contrato
        </Button>
      </div>

      {/* Formulário de geração de contrato DESATIVADO temporariamente */}
      {false && showForm && (
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
              label="Nome do Comprador"
              name="clienteNome"
              required
              autoComplete="name"
              placeholder="Ex: João da Silva"
              containerClassName="sm:col-span-1"
            />

            <Input
              label="CPF / CNPJ"
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
              label="Endereço Completo"
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
              label="Valor Total (R$)"
              type="text"
              inputMode="decimal"
              required
              value={valor}
              onChange={(e) => setValor(maskMoney(e.target.value))}
              placeholder="R$ 0,00"
            />

            <Input
              label="Forma de Pagamento"
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

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Input
          placeholder="Buscar por veículo, contrato ou observação..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          containerClassName="w-full sm:max-w-sm"
        />
        <Select
          value={veiculoFiltro}
          onChange={(e) => {
            setVeiculoFiltro(e.target.value)
            setPage(1)
          }}
          containerClassName="w-full sm:max-w-xs"
        >
          <option value="">Todos os veículos com contrato</option>
          {veiculosAgrupados.map((g) => (
            <option key={g.veiculoId} value={g.veiculoId}>
              {g.veiculoResumo} ({g.contratos.length})
            </option>
          ))}
        </Select>
        <div className="text-xs text-neutral-500 hidden sm:block whitespace-nowrap ml-auto">
          {filteredAgrupados.length === 0
            ? '0 veículos'
            : `Mostrando ${fromItem}–${toItem} de ${filteredAgrupados.length} veículos`}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<IconFileText size={24} />}
          title={search ? 'Nenhum veículo encontrado' : 'Nenhum contrato cadastrado'}
          description={
            search
              ? 'Tente ajustar a busca para localizar veículos ou contratos.'
              : 'Clique em "Anexar Contrato" para adicionar o primeiro contrato a um veículo.'
          }
        />
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
          <Table>
            <THead>
              <tr>
                <TH>Veículo</TH>
                <TH>Qtd. Contratos</TH>
                <TH>Última Emissão</TH>
                <TH align="right">Ações</TH>
              </tr>
            </THead>
            <TBody>
              {visible.map((group) => (
                <TR key={group.veiculoId}>
                  <TD>
                    <div className="flex flex-col">
                      <Link
                        href={`/veiculos/${group.veiculoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-neutral-900 hover:text-liberty-deep hover:underline transition-colors"
                      >
                        {group.veiculoResumo}
                      </Link>
                      {group.veiculoPlaca && (
                        <span className="text-xs text-neutral-500 font-mono">
                          Placa: {group.veiculoPlaca}
                        </span>
                      )}
                    </div>
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                      <IconFiles size={13} className="text-neutral-500" />
                      {group.contratos.length}{' '}
                      {group.contratos.length === 1 ? 'contrato' : 'contratos'}
                    </span>
                  </TD>
                  <TD className="text-xs text-neutral-600">{formatDate(group.ultimaData)}</TD>
                  <TD align="right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<IconEye size={15} />}
                        onClick={() => setVerContratosVeiculoId(group.veiculoId)}
                      >
                        Ver Contratos
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<IconPlus size={15} />}
                        onClick={() => {
                          setSelectedVeiculoId(group.veiculoId)
                          setAnexarModalOpen(true)
                        }}
                      >
                        Adicionar
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

      {/* Modal Ver Contratos do Veículo */}
      <Modal
        open={!!activeGroup}
        onClose={() => setVerContratosVeiculoId(null)}
        title={`Contratos do Veículo`}
        description={activeGroup ? activeGroup.veiculoResumo : ''}
        size="lg"
      >
        {activeGroup && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between bg-neutral-50 p-3 rounded-lg border border-neutral-200">
              <div className="text-xs text-neutral-600">
                Total de <strong className="text-neutral-900">{activeGroup.contratos.length}</strong>{' '}
                {activeGroup.contratos.length === 1 ? 'contrato anexado' : 'contratos anexados'}
              </div>
              <Button
                size="sm"
                variant="liberty"
                leftIcon={<IconPlus size={15} />}
                onClick={() => {
                  setSelectedVeiculoId(activeGroup.veiculoId)
                  setAnexarModalOpen(true)
                }}
              >
                Anexar Novo Contrato
              </Button>
            </div>

            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              <Table>
                <THead>
                  <tr>
                    <TH>Descrição / Documento</TH>
                    <TH>Data</TH>
                    <TH align="right">Ações</TH>
                  </tr>
                </THead>
                <TBody>
                  {activeGroup.contratos.map((c) => (
                    <TR key={c.id}>
                      <TD>
                        <div className="flex flex-col">
                          <span className="font-medium text-neutral-900">
                            {c.clienteNome || 'Contrato sem nome'}
                          </span>
                          {c.clausulasExtras && (
                            <span className="text-xs text-neutral-500 line-clamp-1">
                              {c.clausulasExtras}
                            </span>
                          )}
                          {c.criadoPorEmail && (
                            <span className="text-[11px] text-neutral-400">
                              Enviado por: {c.criadoPorEmail}
                            </span>
                          )}
                        </div>
                      </TD>
                      <TD className="text-xs text-neutral-600 whitespace-nowrap">
                        {formatDate(c.criadoEm || c.dataEmissao)}
                      </TD>
                      <TD align="right" className="whitespace-nowrap">
                        <div className="inline-flex gap-2">
                          <a
                            href={`/api/veiculos/${c.veiculoId}/contratos/${c.id}/pdf`}
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
                            aria-label={`Excluir contrato`}
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
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setVerContratosVeiculoId(null)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Anexar Contrato */}
      <Modal
        open={anexarModalOpen}
        onClose={() => !isUploading && setAnexarModalOpen(false)}
        title="Anexar Contrato ao Veículo"
        description="Selecione o veículo comercializado e envie o arquivo PDF do contrato (compra/venda, aditivo ou termo)."
        size="md"
      >
        <form onSubmit={handleAnexarSubmit} className="mt-2 space-y-4">
          <Select
            label="Veículo *"
            required
            value={selectedVeiculoId}
            onChange={(e) => setSelectedVeiculoId(e.target.value)}
            disabled={isUploading}
          >
            <option value="" disabled>
              Selecione o veículo
            </option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.marca} {v.modelo} ({v.ano ?? 'N/A'}) {v.placa ? `- Placa ${v.placa}` : ''}
              </option>
            ))}
          </Select>

          <Input
            label="Arquivo PDF do Contrato"
            name="pdf"
            type="file"
            accept="application/pdf"
            required
            hint="Permitidos apenas arquivos .pdf (máx. 10MB)"
            disabled={isUploading}
          />

          <Textarea
            label="Descrição / Observação (opcional)"
            name="descricao"
            rows={3}
            placeholder="Ex.: Contrato de compra e venda assinado em 26/07/2026, Aditivo de garantia..."
            disabled={isUploading}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAnexarModalOpen(false)}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="liberty"
              loading={isUploading}
              loadingLabel="Enviando..."
              leftIcon={<IconUpload size={16} stroke={2.5} />}
            >
              Anexar Contrato
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.id)}
        title="Excluir contrato?"
        description={
          confirmDelete ? (
            <>
              Tem certeza que deseja excluir este contrato ({confirmDelete.clienteNome})? Esta
              ação removerá também o PDF gravado.
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

