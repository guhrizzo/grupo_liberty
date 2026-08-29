'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconPlus,
  IconScale,
  IconPencil,
  IconTrash,
  IconCalendar,
  IconUser,
  IconCar,
  IconNotes,
  IconFileText,
  IconFileDownload,
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
import { maskCPFCNPJ } from '@/utils/masks'
import type { BadgeTone } from '@/app/components/ui/StatusBadge'
import {
  createProcesso,
  updateProcesso,
  deleteProcesso,
  getProcessos,
  getAnotacoesGerais,
  getAnotacoesProcesso,
} from './actions'
import type { Processo, ProcessoStatus, AnotacoesContagem, Anotacao } from './types'
import type { ClienteVeiculoInfo } from './actions'
import type { Veiculo } from '@/app/dashboard/veiculos/actions'
import type { VeiculoContrato } from '@/app/veiculos/[id]/actions'
import { VeiculoPicker } from './VeiculoPicker'
import AnotacoesModal from './AnotacoesModal'

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

/**
 * Scroll suave forçado via JS (requestAnimationFrame + easing).
 * Não usa `scroll-behavior: smooth` nem `scrollIntoView({ behavior })`
 * porque esses respeitam "reduzir movimento" do SO / modo de desempenho
 * do Windows e caem para um salto seco. Aqui a animação é manual, então
 * sempre roda suave.
 */
function smoothScrollToY(targetY: number, duration = 550) {
  if (typeof window === 'undefined') return
  const startY = window.scrollY
  const maxY = document.documentElement.scrollHeight - window.innerHeight
  const destY = Math.max(0, Math.min(targetY, maxY))
  const diff = destY - startY
  if (Math.abs(diff) < 2) return

  const easeInOutQuad = (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

  let startTime: number | null = null
  const step = (now: number) => {
    if (startTime === null) startTime = now
    const progress = Math.min((now - startTime) / duration, 1)
    window.scrollTo(0, startY + diff * easeInOutQuad(progress))
    if (progress < 1) window.requestAnimationFrame(step)
  }
  window.requestAnimationFrame(step)
}

export default function JuridicoClient({
  currentRole,
  currentUid,
  initialProcessos,
  veiculos,
  clientesPorVeiculo,
  initialContagem,
  contratosJuridico,
}: {
  currentRole: string
  currentUid: string
  initialProcessos: Processo[]
  veiculos: Veiculo[]
  clientesPorVeiculo: Record<string, ClienteVeiculoInfo>
  initialContagem: AnotacoesContagem
  contratosJuridico: VeiculoContrato[]
}) {
  const router = useRouter()
  const isAdmin = currentRole === 'admin'

  // Resumo legível de cada veículo (marca modelo ano • placa) para exibir
  // junto dos contratos enviados pelo setor de Contratos.
  const veiculoResumoPorId = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of veiculos) {
      map.set(
        v.id,
        `${v.marca} ${v.modelo}${v.ano ? ` ${v.ano}` : ''}${v.placa ? ` • ${v.placa}` : ''}`,
      )
    }
    return map
  }, [veiculos])

  // ─── Anotações (mural geral + por processo) ────────────────────────────────
  // A página carrega apenas a contagem; as listas são buscadas ao abrir cada
  // painel (mesmo padrão dos demais módulos: sem fetch dentro de efeito).
  const [contagem, setContagem] = useState<AnotacoesContagem>(initialContagem)

  const [muralOpen, setMuralOpen] = useState(false)
  const [muralAnotacoes, setMuralAnotacoes] = useState<Anotacao[]>([])
  const [muralLoading, setMuralLoading] = useState(false)

  const [anotProcesso, setAnotProcesso] = useState<Processo | null>(null)
  const [procAnotacoes, setProcAnotacoes] = useState<Anotacao[]>([])
  const [procLoading, setProcLoading] = useState(false)

  const carregarMural = useCallback(async () => {
    setMuralLoading(true)
    try {
      const lista = await getAnotacoesGerais()
      setMuralAnotacoes(lista)
      setContagem((c) => ({ ...c, geral: lista.length }))
    } finally {
      setMuralLoading(false)
    }
  }, [])

  const carregarProc = useCallback(async (processoId: string) => {
    setProcLoading(true)
    try {
      const lista = await getAnotacoesProcesso(processoId)
      setProcAnotacoes(lista)
      setContagem((c) => ({
        ...c,
        porProcesso: { ...c.porProcesso, [processoId]: lista.length },
      }))
    } finally {
      setProcLoading(false)
    }
  }, [])

  function abrirMural() {
    setMuralAnotacoes([])
    setMuralOpen(true)
    void carregarMural()
  }

  function abrirAnotProcesso(p: Processo) {
    setProcAnotacoes([])
    setAnotProcesso(p)
    void carregarProc(p.id)
  }
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
  const [formClienteCpf, setFormClienteCpf] = useState('')
  const [formTitulo, setFormTitulo] = useState('')
  // Contrato (PDF anexado) que está sendo transformado em processo real.
  const [convertingContrato, setConvertingContrato] = useState<VeiculoContrato | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  // Sobe a página até o formulário (que fica no fim, abaixo do bloco de
  // contratos) com scroll suave forçado. Espera o form montar via rAF.
  const scrollToForm = useCallback(() => {
    let tries = 0
    const tick = () => {
      const el = formRef.current
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 88
        smoothScrollToY(top)
      } else if (tries++ < 10) {
        window.requestAnimationFrame(tick)
      }
    }
    window.requestAnimationFrame(tick)
  }, [])

  function openCreate() {
    setEditing(null)
    setConvertingContrato(null)
    setFormVeiculoId('')
    setFormVeiculoResumo('')
    setFormCliente('')
    setFormClienteCpf('')
    setFormTitulo('')
    setShowForm(true)
  }

  function openEdit(p: Processo) {
    setEditing(p)
    setConvertingContrato(null)
    setFormVeiculoId(p.veiculoId ?? '')
    setFormVeiculoResumo(p.veiculoResumo ?? '')
    setFormCliente(p.cliente)
    setFormClienteCpf(p.clienteCpf ?? '')
    setFormTitulo(p.titulo)
    setShowForm(true)
  }

  function openConverterContrato(c: VeiculoContrato) {
    const cli = clientesPorVeiculo[c.veiculoId]
    const resumo = veiculoResumoPorId.get(c.veiculoId) ?? c.fileName
    setEditing(null)
    setConvertingContrato(c)
    setFormVeiculoId(c.veiculoId)
    setFormVeiculoResumo(resumo)
    setFormCliente(cli?.nome ?? '')
    setFormClienteCpf(cli?.cpf ? maskCPFCNPJ(cli.cpf) : '')
    setFormTitulo(cli?.nome ? `Contrato - ${cli.nome}` : `Contrato - ${resumo}`)
    setShowForm(true)
    scrollToForm()
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setConvertingContrato(null)
  }

  const handleSelectVeiculo = useCallback(
    (id: string) => {
      const v = veiculos.find((x) => x.id === id)
      const nomeVeiculo = v ? `${v.marca} ${v.modelo}${v.ano ? ` ${v.ano}` : ''}` : ''
      const resumo = v ? `${nomeVeiculo}${v.placa ? ` • ${v.placa}` : ''}` : ''
      setFormVeiculoId(id)
      setFormVeiculoResumo(resumo)
      if (nomeVeiculo) setFormTitulo(nomeVeiculo)

      // Prioriza o comprador de um contrato de venda já emitido (dado mais
      // recente); na ausência, usa o vendedor/consignante cadastrado nos
      // "Dados do Vendedor" do próprio veículo. CPF acompanha o mesmo par.
      const contratoInfo = clientesPorVeiculo[id]
      const nome = contratoInfo?.nome || v?.sellerName || null
      const cpf = contratoInfo?.cpf || v?.sellerCpf || null
      if (nome) {
        setFormCliente(nome)
        toast.success(`Cliente preenchido: ${nome}`)
      }
      if (cpf) setFormClienteCpf(maskCPFCNPJ(cpf))
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

    if (convertingContrato) {
      form.set('contratoOrigemId', convertingContrato.id)
    }

    try {
      const result = editing
        ? await updateProcesso(editing.id, form)
        : await createProcesso(form)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(
        result.success ||
          (editing
            ? 'Processo atualizado.'
            : convertingContrato
              ? 'Contrato registrado como processo.'
              : 'Processo cadastrado.'),
      )
      closeForm()
      if (!editing) setPage(1)

      // Atualiza a lista na hora. O `processos` vive em useState e não
      // reidrata sozinho com o router.refresh(), então recarregamos os
      // dados (getProcessos já devolve o CPF descriptografado).
      try {
        setProcessos(await getProcessos())
      } catch {
        // fallback: pelo menos insere/atualiza otimisticamente
        if (result.processo) {
          const novo = result.processo
          setProcessos((prev) =>
            editing
              ? prev.map((p) => (p.id === novo.id ? novo : p))
              : [novo, ...prev],
          )
        }
      }
      router.refresh()
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

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            variant="secondary"
            onClick={abrirMural}
            leftIcon={<IconNotes size={16} stroke={2.5} />}
          >
            Anotações
            {contagem.geral > 0 && (
              <span className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-liberty/15 px-1.5 text-[11px] font-bold text-liberty-deep">
                {contagem.geral}
              </span>
            )}
          </Button>
          <Button
            variant="liberty"
            onClick={openCreate}
            leftIcon={<IconPlus size={16} stroke={2.5} />}
          >
            Novo Processo
          </Button>
        </div>
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
        <div
          ref={formRef}
          className="rounded-xl border border-neutral-200 bg-white p-6 shadow-xs scroll-mt-24"
        >
          <h2
            className={`text-lg font-semibold text-neutral-900 flex items-center gap-2 ${
              convertingContrato ? 'mb-1' : 'mb-5'
            }`}
          >
            <IconScale size={20} className="text-liberty-deep" />
            {editing
              ? 'Editar Processo'
              : convertingContrato
                ? 'Registrar Contrato como Processo'
                : 'Cadastrar Processo'}
          </h2>
          {convertingContrato && (
            <p className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
              <IconFileText size={13} className="text-liberty-deep" />
              A partir do documento{' '}
              <strong className="text-neutral-700">
                {convertingContrato.descricao || convertingContrato.fileName}
              </strong>
              . Complete os campos e salve para criar o registro.
            </p>
          )}
          <form
            key={editing?.id ?? convertingContrato?.id ?? 'novo'}
            onSubmit={handleSubmit}
            className="grid gap-4 sm:grid-cols-2"
          >
            {convertingContrato && (
              <input type="hidden" name="contratoOrigemId" value={convertingContrato.id} />
            )}
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

            <Input
              label="CPF do cliente"
              name="clienteCpf"
              value={formClienteCpf}
              onChange={(e) => setFormClienteCpf(maskCPFCNPJ(e.target.value))}
              placeholder="000.000.000-00"
              autoComplete="off"
              inputMode="numeric"
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

            <Select
              label="Tipo *"
              name="tipo"
              required
              defaultValue={
                editing?.tipo ??
                (convertingContrato ? 'Contrato de compra e venda' : '')
              }
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
              defaultValue={
                editing?.observacoes ??
                (convertingContrato
                  ? `Registro criado a partir do contrato anexado "${
                      convertingContrato.descricao || convertingContrato.fileName
                    }" (enviado por ${convertingContrato.uploadedByEmail || 'usuário'}).`
                  : '')
              }
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
                    : convertingContrato
                      ? 'Criar Processo'
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
          cliente: clientesPorVeiculo[v.id]?.nome || v.sellerName || null,
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
                        onClick={() => abrirAnotProcesso(p)}
                        leftIcon={<IconNotes size={12} />}
                      >
                        Anotações
                        {(contagem.porProcesso[p.id] ?? 0) > 0 && (
                          <span className="ml-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-liberty/15 px-1 text-[10px] font-bold text-liberty-deep">
                            {contagem.porProcesso[p.id]}
                          </span>
                        )}
                      </Button>
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

      {contratosJuridico.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-liberty/30 bg-liberty/[0.03] shadow-xs">
          <div className="flex items-center gap-2 border-b border-liberty/20 bg-liberty/5 px-4 py-3">
            <IconFileText size={18} className="shrink-0 text-liberty-deep" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-neutral-900">
                Contratos enviados pelo setor de Contratos
              </h2>
              <p className="text-[11px] text-neutral-500">
                Contratos anexados na aba Contratos e marcados como “Adicionar ao Jurídico”.
              </p>
            </div>
            <span className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full bg-liberty/15 px-2 text-xs font-bold text-liberty-deep">
              {contratosJuridico.length}
            </span>
          </div>
          <Table>
            <THead>
              <tr>
                <TH>Documento / Veículo</TH>
                <TH>Enviado por</TH>
                <TH>Data</TH>
                <TH align="right">Ações</TH>
              </tr>
            </THead>
            <TBody>
              {contratosJuridico.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-neutral-900">
                        {c.descricao || c.fileName}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-liberty/30 bg-liberty/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-liberty-deep">
                        <IconFileText size={11} /> via Contratos
                      </span>
                      {c.processoId && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          <IconScale size={11} /> registrado como processo
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-400">
                      <IconCar size={11} stroke={2} />
                      {veiculoResumoPorId.get(c.veiculoId) || c.veiculoId}
                    </div>
                  </TD>
                  <TD className="text-xs text-neutral-600">{c.uploadedByEmail || '—'}</TD>
                  <TD className="text-xs text-neutral-600 whitespace-nowrap">
                    {formatDate(c.uploadedAt)}
                  </TD>
                  <TD align="right" className="whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <a
                        href={`/api/veiculos/${c.veiculoId}/contratos/${c.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 cursor-pointer"
                      >
                        <IconFileDownload size={14} />
                        Ver PDF
                      </a>
                      {c.processoId ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <IconScale size={14} />
                          Processo criado
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="liberty"
                          onClick={() => openConverterContrato(c)}
                          leftIcon={<IconScale size={14} />}
                        >
                          Registrar como processo
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {!isAdmin && (
        <p className="text-[11px] text-neutral-400">
          Você está logado como advogado. Apenas administradores podem cadastrar novos usuários no sistema.
        </p>
      )}

      {muralOpen && (
        <AnotacoesModal
          open
          onClose={() => setMuralOpen(false)}
          escopo="geral"
          anotacoes={muralAnotacoes}
          loading={muralLoading}
          currentUid={currentUid}
          isAdmin={isAdmin}
          onMutated={carregarMural}
        />
      )}

      {anotProcesso && (
        <AnotacoesModal
          open
          onClose={() => setAnotProcesso(null)}
          escopo="processo"
          processoId={anotProcesso.id}
          processoTitulo={anotProcesso.titulo}
          anotacoes={procAnotacoes}
          loading={procLoading}
          currentUid={currentUid}
          isAdmin={isAdmin}
          onMutated={() => carregarProc(anotProcesso.id)}
        />
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
