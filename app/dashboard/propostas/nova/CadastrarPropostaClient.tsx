'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  IconUser,
  IconMail,
  IconPhone,
  IconCoin,
  IconArrowLeft,
  IconFolderOpen,
  IconFileText,
  IconCheck,
  IconX,
  IconCar,
  IconShieldCheck,
  IconArrowRight,
  IconSparkles,
  IconTool,
  IconTrash,
  IconPlus,
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconCalendar,
  IconHash,
  IconReceipt,
  IconAlertTriangle,
  IconCalculator,
} from '@tabler/icons-react'
import {
  Breadcrumb,
  useToast,
  Input,
  Textarea,
  BancoAutocomplete,
} from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'
import { parseMoney, onlyDigits, maskPlate } from '@/utils/masks'
import { validarCPF } from '@/utils/validadorCpf'
import { getBancoByNome } from '@/constants/bancos'
import { createProposta, type CreatePropostaInput } from '../actions'

interface CadastrarPropostaClientProps {
  veiculos?: Array<{ id: string; marca: string; modelo: string; preco: number | null; ano?: number | null; foto?: string | null }>
}

type SectionKey = 'cliente' | 'veiculo' | 'pendencias' | 'parcelas' | 'pecas' | 'proposta' | 'previa'

const ALL_SECTIONS: SectionKey[] = [
  'cliente',
  'veiculo',
  'pendencias',
  'parcelas',
  'pecas',
  'proposta',
  'previa',
]

interface FormData {
  // Cliente
  nome: string
  cpf: string
  telefone: string
  email: string
  cliente_data: string
  numero_contrato: string

  // Veículo
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_ano: string
  veiculo_placa: string
  veiculo_valor_fipe: string
  valor_estimado_divida: string

  // Pendências
  valor_ipva: string
  valor_licenciamento: string
  valor_multas: string

  // Parcelas
  valor_parcela: string
  parcelas_totais: string
  parcelas_pagas: string
  parcelas_atrasadas: string
  banco: string

  // Peças
  pecas: Array<{ nome: string; valor: string }>

  // Proposta
  valor_proposta: string
  mensagem: string
}

const TODAY_DATE = () => new Date().toISOString().slice(0, 10)
const generateFileSuffix = () => Date.now().toString(36).toUpperCase()

const maskCpfCnpj = (raw: string) => {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

const maskPhone = (raw: string) => {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

const maskMoney = (raw: string) => {
  const d = onlyDigits(raw)
  if (!d) return ''
  const num = (parseInt(d, 10) / 100).toFixed(2)
  const [int, dec] = num.split('.')
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${intFmt},${dec}`
}

function FormattedMoneyHint({ value }: { value: string }) {
  const num = value.trim() ? parseMoney(value) : null
  if (num == null || num <= 0) return null
  return (
    <p className="mt-1 text-[11px] font-semibold text-liberty-deep">
      {formatCurrency(num)}
    </p>
  )
}

function SectionHeader({
  id,
  icon: Icon,
  title,
  subtitle,
  open,
  onToggle,
  badge,
}: {
  id: SectionKey
  icon: React.ComponentType<{ size?: number; stroke?: number; className?: string }>
  title: string
  subtitle?: string
  open: boolean
  onToggle: () => void
  badge?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={`section-${id}`}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50/60 md:px-6 md:py-4 cursor-pointer"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-liberty/10 text-liberty">
          <Icon size={16} stroke={2} className="text-liberty" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
            Seção
          </p>
          <h3 className="mt-0.5 truncate text-sm font-bold text-neutral-950 md:text-base">
            {title}
          </h3>
          {subtitle && !open && (
            <p className="mt-0.5 truncate text-xs text-neutral-500">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            {badge}
          </span>
        )}
        <IconChevronDown
          size={18}
          stroke={2}
          className={`shrink-0 text-neutral-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </div>
    </button>
  )
}

function SectionBody({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`px-4 pb-5 md:px-6 md:pb-6 ${last ? '' : 'border-b border-neutral-100'}`}>
      {children}
    </div>
  )
}

export default function CadastrarPropostaClient({ veiculos = [] }: CadastrarPropostaClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)

  const [openSections, setOpenSections] = useState<Set<SectionKey>>(
    () => new Set<SectionKey>(['cliente', 'veiculo']),
  )

  const toggleSection = useCallback((id: SectionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const openAll = () => setOpenSections(new Set(ALL_SECTIONS))
  const closeAll = () => setOpenSections(new Set())

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [dirName, setDirName] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('liberty_pdf_dir_name')
    }
    return null
  })
  const [fileName, setFileName] = useState('')
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    cliente_data: TODAY_DATE(),
    numero_contrato: '',

    veiculo_marca: '',
    veiculo_modelo: '',
    veiculo_ano: '',
    veiculo_placa: '',
    veiculo_valor_fipe: '',
    valor_estimado_divida: '',

    valor_ipva: '',
    valor_licenciamento: '',
    valor_multas: '',

    valor_parcela: '',
    parcelas_totais: '',
    parcelas_pagas: '',
    parcelas_atrasadas: '',
    banco: '',

    pecas: [],

    valor_proposta: '',
    mensagem: '',
  })
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData | 'pecas', string>>>({})

  const closeConfirm = useCallback(() => {
    if (creating) return
    setConfirmOpen(false)
    setFileName('')
  }, [creating])

  const setField = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }))
      setFormErrors((prev) => {
        if (!prev[key]) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    [],
  )

  const handleEscolherPasta = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        toast.info(
          'Seu navegador não oferece suporte à escolha de pastas nativa. O PDF será baixado na sua pasta de Downloads padrão.',
          'Recurso Indisponível'
        )
        return
      }
      const handle = await (window as Window & {
        showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
      }).showDirectoryPicker!({ mode: 'readwrite' })
      setDirHandle(handle)
      setDirName(handle.name)
      localStorage.setItem('liberty_pdf_dir_name', handle.name)
      toast.success(`Pasta "${handle.name}" selecionada com sucesso!`, 'Pronto')
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error('Ocorreu um erro ao selecionar a pasta.', 'Falha')
      }
    }
  }

  const sanitizeFileName = (raw: string, fallback: string) => {
    let nome = raw.trim() || fallback
    if (!nome.toLowerCase().endsWith('.pdf')) nome = `${nome}.pdf`
    return nome.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  }

  const triggerBlobDownload = (blob: Blob, finalName: string) => {
    const dlUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = dlUrl
    a.download = finalName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(dlUrl)
  }

  const saveBlobToDir = async (blob: Blob, finalName: string): Promise<boolean> => {
    if (!dirHandle || !('showDirectoryPicker' in window)) return false
    try {
      const options = { mode: 'readwrite' as const }
      const handle = dirHandle as unknown as FileSystemDirectoryHandle & {
        queryPermission: (opts: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'prompt' | 'denied'>
        requestPermission: (opts: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'prompt' | 'denied'>
      }
      if ((await handle.queryPermission(options)) !== 'granted') {
        if ((await handle.requestPermission(options)) !== 'granted') {
          return false
        }
      }
      const fileHandle = await dirHandle.getFileHandle(finalName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(blob)
      await writable.close()
      return true
    } catch (err) {
      console.error('Falha ao gravar arquivo:', err)
      return false
    }
  }

  const buildPayloadFromForm = (): CreatePropostaInput => {
    const valorPropostaNum =
      formData.valor_proposta.trim() ? parseMoney(formData.valor_proposta) : null

    const pecasNumeradas = formData.pecas.map((p) => ({
      nome: p.nome.trim(),
      valor: p.valor.trim() ? parseMoney(p.valor) : 0,
    }))

    return {
      nome: formData.nome.trim(),
      cpf: onlyDigits(formData.cpf),
      telefone: formData.telefone.trim(),
      email: formData.email.trim(),
      cliente_data: formData.cliente_data || null,
      numero_contrato: formData.numero_contrato.trim() || null,

      veiculo_marca: formData.veiculo_marca.trim(),
      veiculo_modelo: formData.veiculo_modelo.trim(),
      veiculo_ano: formData.veiculo_ano.trim() ? Number(formData.veiculo_ano) : null,
      veiculo_placa: formData.veiculo_placa.trim(),
      veiculo_valor_fipe: formData.veiculo_valor_fipe.trim()
        ? parseMoney(formData.veiculo_valor_fipe)
        : null,
      valor_estimado_divida: formData.valor_estimado_divida.trim()
        ? parseMoney(formData.valor_estimado_divida)
        : null,

      valor_ipva: formData.valor_ipva.trim() ? parseMoney(formData.valor_ipva) : null,
      valor_licenciamento: formData.valor_licenciamento.trim()
        ? parseMoney(formData.valor_licenciamento)
        : null,
      valor_multas: formData.valor_multas.trim() ? parseMoney(formData.valor_multas) : null,

      valor_parcela: formData.valor_parcela.trim() ? parseMoney(formData.valor_parcela) : null,
      parcelas_totais: formData.parcelas_totais.trim() ? Number(formData.parcelas_totais) : null,
      parcelas_pagas: formData.parcelas_pagas.trim() ? Number(formData.parcelas_pagas) : null,
      parcelas_atrasadas: formData.parcelas_atrasadas.trim()
        ? Number(formData.parcelas_atrasadas)
        : null,
      banco: formData.banco.trim() || null,

      pecasConserto: pecasNumeradas,

      valor: valorPropostaNum,
      mensagem: formData.mensagem.trim(),
      proposta_previa: propostaPreviaCalc.valor,
    }
  }

  const buildPdfPayload = () => {
    const p = buildPayloadFromForm()
    return {
      veiculo_id: '',
      nome: p.nome,
      cpf: p.cpf,
      telefone: p.telefone,
      email: p.email,
      valor: p.valor,
      mensagem: p.mensagem,
      status: 'pendente' as const,
      cliente_data: p.cliente_data ?? null,
      numero_contrato: p.numero_contrato ?? null,
      veiculo_marca: p.veiculo_marca,
      veiculo_modelo: p.veiculo_modelo,
      veiculo_ano: p.veiculo_ano,
      veiculo_placa: p.veiculo_placa,
      veiculo_valor_fipe: p.veiculo_valor_fipe,
      valor_estimado_divida: p.valor_estimado_divida,
      valor_ipva: p.valor_ipva,
      valor_licenciamento: p.valor_licenciamento,
      valor_multas: p.valor_multas,
      valor_parcela: p.valor_parcela,
      parcelas_totais: p.parcelas_totais,
      parcelas_pagas: p.parcelas_pagas,
      parcelas_atrasadas: p.parcelas_atrasadas,
      banco: p.banco,
      pecasConserto: p.pecasConserto,
      proposta_previa: p.proposta_previa,
    }
  }

  const persistPdf = async (
    payload: ReturnType<typeof buildPdfPayload>,
    finalName: string,
  ): Promise<{ ok: boolean }> => {
    const res = await fetch('/api/propostas/preview-pdf-autorizacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errorText = await res.text()
      toast.error(errorText || 'Erro ao gerar PDF.', 'Falha no PDF')
      return { ok: false }
    }
    const blob = await res.blob()

    const saved = await saveBlobToDir(blob, finalName)
    if (saved) {
      toast.success(`PDF salvo em: ${dirName}/${finalName}`, 'Salvo com sucesso!')
    } else {
      triggerBlobDownload(blob, finalName)
      toast.success('PDF de autorização baixado.', 'Pronto!')
    }
    return { ok: true }
  }

  const handleConfirmSave = async () => {
    setCreating(true)
    try {
      const payload = buildPayloadFromForm()
      const finalName = sanitizeFileName(
        fileName,
        `proposta-${payload.numero_contrato?.replace(/^#/, '') || 'preview'}-${generateFileSuffix()}`,
      )

      const pdfPayload = buildPdfPayload()
      const persist = await persistPdf(pdfPayload, finalName)
      if (!persist.ok) {
        setCreating(false)
        return
      }

      const res = await createProposta(payload)
      if (res.error || !res.success) {
        toast.error(res.error || 'Não foi possível cadastrar', 'Erro ao salvar')
        return
      }
      toast.success(res.success, 'Proposta salva no sistema')

      setConfirmOpen(false)
      setFileName('')
      router.push('/dashboard/propostas')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado.'
      toast.error(message, 'Erro')
    } finally {
      setCreating(false)
    }
  }

  const handleConfirmDiscard = async () => {
    if (creating) return
    setCreating(true)
    try {
      buildPayloadFromForm()
      const finalName = sanitizeFileName(fileName, `proposta-rascunho`)
      const pdfPayload = buildPdfPayload()
      const persist = await persistPdf(pdfPayload, finalName)
      if (persist.ok) {
        toast.info('Proposta descartada do banco. PDF gerado.', 'Não salvar')
      }
      setConfirmOpen(false)
      setFileName('')
      router.push('/dashboard/propostas')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado.'
      toast.error(message, 'Erro')
    } finally {
      setCreating(false)
    }
  }

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData | 'pecas', string>> = {}

    const nomeTrim = formData.nome.trim()
    if (!nomeTrim || nomeTrim.length < 2) {
      errors.nome = 'Informe o nome completo do cliente.'
    }
    const cpfDigits = onlyDigits(formData.cpf)
    if (!cpfDigits) errors.cpf = 'Informe o CPF.'
    else if (!validarCPF(cpfDigits)) errors.cpf = 'CPF inválido.'

    const telDigits = onlyDigits(formData.telefone)
    if (!telDigits || telDigits.length < 10) {
      errors.telefone = 'Informe um telefone com DDD.'
    }

    const emailTrim = formData.email.trim()
    if (!emailTrim || !emailTrim.includes('@') || !emailTrim.includes('.')) {
      errors.email = 'Informe um e-mail válido.'
    }

    if (!formData.veiculo_marca.trim()) errors.veiculo_marca = 'Informe a marca.'
    if (!formData.veiculo_modelo.trim()) errors.veiculo_modelo = 'Informe o modelo.'

    if (!formData.mensagem.trim()) {
      errors.mensagem = 'Descreva o interesse do cliente.'
    }

    const pecasInvalidas = formData.pecas.filter((p) => !p.nome.trim() && p.valor.trim())
    if (pecasInvalidas.length > 0) {
      errors.pecas = 'Preencha o nome de todas as peças com valor.'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      toast.error('Confira os campos destacados antes de continuar.', 'Formulário incompleto')
      return false
    }

    setFormErrors({})
    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) {
      setOpenSections(new Set(ALL_SECTIONS))
      return
    }
    setFileName(
      formData.numero_contrato.trim()
        ? `proposta-${formData.numero_contrato.replace(/^#/, '').trim()}-${Date.now().toString(36).toUpperCase()}`
        : `proposta-${Date.now().toString(36).toUpperCase()}`,
    )
    setConfirmOpen(true)
  }

  const valorPropostaNum = formData.valor_proposta.trim()
    ? parseMoney(formData.valor_proposta)
    : null

  const totalPecas = useMemo(() => {
    return formData.pecas.reduce((acc, p) => {
      if (!p.nome.trim()) return acc
      const v = p.valor.trim() ? parseMoney(p.valor) : 0
      return acc + v
    }, 0)
  }, [formData.pecas])

  // Proposta Prévia = metade da FIPE − quitação estimada, onde a quitação
  // estimada é a dívida em aberto (parcelas restantes [totais − pagas] ×
  // valor da parcela) × (1 − % quitação do banco) — a % de quitação é um
  // desconto sobre a dívida, não a fração a pagar. Ex.: dívida 135.999 com
  // 70% de quitação → quitação estimada = 135.999 × 0,30 = 40.799,70.
  // A % de quitação usada aqui vem da coluna "Descontos" da tabela de
  // bancos (BancoInfo.descontoPercent), casada pelo nome digitado no campo
  // "Banco / Financeira".
  const propostaPreviaParcelasEmAberto = Math.max(
    0,
    (Number(formData.parcelas_totais) || 0) - (Number(formData.parcelas_pagas) || 0),
  )
  const propostaPreviaValorParcela = formData.valor_parcela.trim()
    ? parseMoney(formData.valor_parcela)
    : 0
  const propostaPreviaDividaTotal =
    propostaPreviaParcelasEmAberto * propostaPreviaValorParcela

  const propostaPreviaBancoInfo = getBancoByNome(formData.banco)
  const propostaPreviaQuitacaoPercent = propostaPreviaBancoInfo?.descontoPercent ?? null
  const propostaPreviaQuitacaoEstimada =
    propostaPreviaQuitacaoPercent != null
      ? propostaPreviaDividaTotal * (1 - propostaPreviaQuitacaoPercent / 100)
      : null

  const propostaPreviaValorFipe = formData.veiculo_valor_fipe.trim()
    ? parseMoney(formData.veiculo_valor_fipe)
    : 0

  const propostaPreviaValorBruto =
    propostaPreviaQuitacaoEstimada != null
      ? propostaPreviaValorFipe / 2 - propostaPreviaQuitacaoEstimada
      : null
  const propostaPreviaValorFinal =
    propostaPreviaValorBruto != null ? Math.max(0, propostaPreviaValorBruto) : null

  const propostaPreviaCalc = {
    parcelasEmAberto: propostaPreviaParcelasEmAberto,
    valorParcela: propostaPreviaValorParcela,
    dividaTotal: propostaPreviaDividaTotal,
    bancoInfo: propostaPreviaBancoInfo,
    quitacaoPercent: propostaPreviaQuitacaoPercent,
    quitacaoEstimada: propostaPreviaQuitacaoEstimada,
    valorFipe: propostaPreviaValorFipe,
    valorBruto: propostaPreviaValorBruto,
    valor: propostaPreviaValorFinal,
  }

  const completion = useMemo(() => {
    const checks: Record<SectionKey, boolean> = {
      cliente: !!(
        formData.nome &&
        onlyDigits(formData.cpf).length >= 11 &&
        formData.email &&
        formData.telefone
      ),
      veiculo: !!(formData.veiculo_marca && formData.veiculo_modelo),
      pendencias: !!(
        formData.valor_ipva ||
        formData.valor_licenciamento ||
        formData.valor_multas
      ),
      parcelas: !!(
        formData.parcelas_totais ||
        formData.parcelas_pagas ||
        formData.parcelas_atrasadas ||
        formData.valor_parcela
      ),
      pecas: formData.pecas.some((p) => p.nome.trim()),
      proposta: !!(valorPropostaNum && valorPropostaNum > 0 && formData.mensagem.trim()),
      previa: propostaPreviaCalc.valor != null && propostaPreviaCalc.valor > 0,
    }
    const total = ALL_SECTIONS.length
    const filled = ALL_SECTIONS.filter((k) => checks[k]).length
    return { pct: Math.round((filled / total) * 100), checks }
  }, [formData, valorPropostaNum, propostaPreviaCalc.valor])

  const isOpen = (id: SectionKey) => openSections.has(id)
  const completed = (id: SectionKey) => completion.checks[id]

  return (
    <div className="space-y-5 pb-28 md:space-y-6 md:pb-0">
      <header className="space-y-3">
        <div className="hidden md:block">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Propostas', href: '/dashboard/propostas' },
              { label: 'Cadastrar' },
            ]}
          />
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-liberty/10 text-liberty">
              <IconSparkles size={22} stroke={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold tracking-tight text-neutral-950 md:text-3xl">
                Cadastrar nova proposta
              </h1>
              <p className="mt-0.5 text-xs text-neutral-500 md:mt-1 md:text-sm">
                Preencha as seções e gere o PDF de autorização — não exige veículo no estoque.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/propostas"
            aria-label="Voltar para Propostas"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer md:px-4"
          >
            <IconArrowLeft size={14} stroke={2.5} />
            <span className="hidden sm:inline">Voltar para Propostas</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-liberty transition-[width] duration-500 ease-out"
              style={{ width: `${completion.pct}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-bold tabular-nums text-neutral-600">
            {completion.pct}%
          </span>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={openAll}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
          >
            <IconChevronDown size={12} stroke={2.5} />
            Expandir tudo
          </button>
          <button
            type="button"
            onClick={closeAll}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
          >
            <IconChevronUp size={12} stroke={2.5} />
            Recolher tudo
          </button>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-neutral-200 bg-white shadow-xs overflow-hidden"
      >
        {/* ───── Cliente ───── */}
        <div className={isOpen('cliente') ? 'border-b border-neutral-100' : ''}>
          <SectionHeader
            id="cliente"
            icon={IconUser}
            title="Dados do cliente"
            subtitle={
              formData.nome && formData.cpf
                ? `${formData.nome} • ${formData.cpf}`
                : 'Nome, CPF, contato e número do contrato'
            }
            open={isOpen('cliente')}
            onToggle={() => toggleSection('cliente')}
            badge={completed('cliente') ? 'OK' : undefined}
          />
          {isOpen('cliente') && (
            <SectionBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Nome completo"
                  name="nome"
                  placeholder="Ex.: João da Silva"
                  value={formData.nome}
                  onChange={(e) => setField('nome', e.target.value)}
                  error={formErrors.nome}
                  leftIcon={<IconUser size={14} />}
                  required
                />
                <Input
                  label="CPF"
                  name="cpf"
                  placeholder="000.000.000-00"
                  value={formData.cpf}
                  inputMode="numeric"
                  onChange={(e) => setField('cpf', maskCpfCnpj(e.target.value))}
                  error={formErrors.cpf}
                  required
                />
                <Input
                  label="Telefone / WhatsApp"
                  name="telefone"
                  placeholder="(00) 00000-0000"
                  value={formData.telefone}
                  inputMode="tel"
                  onChange={(e) => setField('telefone', maskPhone(e.target.value))}
                  error={formErrors.telefone}
                  leftIcon={<IconPhone size={14} />}
                  required
                />
                <Input
                  label="E-mail"
                  name="email"
                  type="email"
                  placeholder="cliente@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setField('email', e.target.value)}
                  error={formErrors.email}
                  leftIcon={<IconMail size={14} />}
                  required
                />
                <Input
                  label="Data da proposta"
                  name="cliente_data"
                  type="date"
                  value={formData.cliente_data}
                  onChange={(e) => setField('cliente_data', e.target.value)}
                  leftIcon={<IconCalendar size={14} />}
                  hint="Data que aparece como capa do PDF."
                />
                <Input
                  label="Número do Contrato"
                  name="numero_contrato"
                  placeholder="Ex.: 2024-001"
                  value={formData.numero_contrato}
                  onChange={(e) => setField('numero_contrato', e.target.value)}
                  leftIcon={<IconHash size={14} />}
                  hint="Deixe vazio para gerar automaticamente."
                />
              </div>
            </SectionBody>
          )}
        </div>

        {/* ───── Veículo ───── */}
        <div className={isOpen('veiculo') ? 'border-b border-neutral-100' : ''}>
          <SectionHeader
            id="veiculo"
            icon={IconCar}
            title="Veículo"
            subtitle={
              formData.veiculo_marca || formData.veiculo_modelo
                ? `${formData.veiculo_marca} ${formData.veiculo_modelo}`.trim()
                : 'Marca, modelo, placa, ano e valor FIPE — digitação livre'
            }
            open={isOpen('veiculo')}
            onToggle={() => toggleSection('veiculo')}
            badge={completed('veiculo') ? 'OK' : undefined}
          />
          {isOpen('veiculo') && (
            <SectionBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Marca"
                  name="veiculo_marca"
                  placeholder="Ex.: Honda"
                  value={formData.veiculo_marca}
                  onChange={(e) => setField('veiculo_marca', e.target.value)}
                  error={formErrors.veiculo_marca}
                  leftIcon={<IconCar size={14} />}
                  required
                />
                <Input
                  label="Modelo"
                  name="veiculo_modelo"
                  placeholder="Ex.: Civic 2.0"
                  value={formData.veiculo_modelo}
                  onChange={(e) => setField('veiculo_modelo', e.target.value)}
                  error={formErrors.veiculo_modelo}
                  required
                />
                <Input
                  label="Placa"
                  name="veiculo_placa"
                  placeholder="ABC-1D23"
                  value={formData.veiculo_placa}
                  onChange={(e) => setField('veiculo_placa', maskPlate(e.target.value))}
                  leftIcon={<IconReceipt size={14} />}
                />
                <Input
                  label="Ano do Veículo"
                  name="veiculo_ano"
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex.: 2022"
                  value={formData.veiculo_ano}
                  onChange={(e) => setField('veiculo_ano', e.target.value)}
                />
                <div>
                  <Input
                    label="Valor FIPE"
                    name="veiculo_valor_fipe"
                    placeholder="0,00"
                    value={formData.veiculo_valor_fipe}
                    inputMode="numeric"
                    onChange={(e) => setField('veiculo_valor_fipe', maskMoney(e.target.value))}
                    leftIcon={<IconCoin size={14} />}
                    hint="Valor de tabela FIPE atual do veículo."
                  />
                  <FormattedMoneyHint value={formData.veiculo_valor_fipe} />
                </div>
                <div>
                  <Input
                    label="Valor estimado da dívida"
                    name="valor_estimado_divida"
                    placeholder="0,00"
                    value={formData.valor_estimado_divida}
                    inputMode="numeric"
                    onChange={(e) =>
                      setField('valor_estimado_divida', maskMoney(e.target.value))
                    }
                    leftIcon={<IconCalculator size={14} />}
                    hint="Estimativa total da dívida do veículo."
                  />
                  <FormattedMoneyHint value={formData.valor_estimado_divida} />
                </div>
              </div>

              {veiculos.length > 0 && (
                <p className="mt-3 text-[11px] text-neutral-500">
                  Você tem {veiculos.length} veículo
                  {veiculos.length === 1 ? '' : 's'} cadastrado
                  {veiculos.length === 1 ? '' : 's'} no estoque. Esta proposta é
                  digitada livremente e não vincula o veículo da lista.
                </p>
              )}
            </SectionBody>
          )}
        </div>

        {/* ───── Pendências ───── */}
        <div className={isOpen('pendencias') ? 'border-b border-neutral-100' : ''}>
          <SectionHeader
            id="pendencias"
            icon={IconAlertTriangle}
            title="Pendências / Débitos"
            subtitle={
              formData.valor_ipva || formData.valor_licenciamento || formData.valor_multas
                ? 'Pendências informadas (valores serão exibidos no PDF)'
                : 'IPVA, licenciamento e multas do veículo'
            }
            open={isOpen('pendencias')}
            onToggle={() => toggleSection('pendencias')}
          />
          {isOpen('pendencias') && (
            <SectionBody>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Input
                    label="Valor do IPVA"
                    name="valor_ipva"
                    placeholder="0,00"
                    value={formData.valor_ipva}
                    inputMode="numeric"
                    onChange={(e) => setField('valor_ipva', maskMoney(e.target.value))}
                    leftIcon={<IconReceipt size={14} />}
                  />
                  <FormattedMoneyHint value={formData.valor_ipva} />
                </div>
                <div>
                  <Input
                    label="Valor do Licenciamento"
                    name="valor_licenciamento"
                    placeholder="0,00"
                    value={formData.valor_licenciamento}
                    inputMode="numeric"
                    onChange={(e) =>
                      setField('valor_licenciamento', maskMoney(e.target.value))
                    }
                    leftIcon={<IconReceipt size={14} />}
                  />
                  <FormattedMoneyHint value={formData.valor_licenciamento} />
                </div>
                <div>
                  <Input
                    label="Valor das Multas"
                    name="valor_multas"
                    placeholder="0,00"
                    value={formData.valor_multas}
                    inputMode="numeric"
                    onChange={(e) => setField('valor_multas', maskMoney(e.target.value))}
                    leftIcon={<IconAlertTriangle size={14} />}
                  />
                  <FormattedMoneyHint value={formData.valor_multas} />
                </div>
              </div>
            </SectionBody>
          )}
        </div>

        {/* ───── Parcelas ───── */}
        <div className={isOpen('parcelas') ? 'border-b border-neutral-100' : ''}>
          <SectionHeader
            id="parcelas"
            icon={IconCalculator}
            title="Parcelas do Financiamento"
            subtitle={
              formData.parcelas_totais || formData.parcelas_pagas
                ? `${formData.parcelas_pagas || '?'}/${formData.parcelas_totais || '?'} pagas`
                : 'Parcelas, valor e banco do financiamento'
            }
            open={isOpen('parcelas')}
            onToggle={() => toggleSection('parcelas')}
          />
          {isOpen('parcelas') && (
            <SectionBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <BancoAutocomplete
                  name="banco"
                  value={formData.banco}
                  onChange={(v) => setField('banco', v)}
                />
                <Input
                  label="Valor das parcelas"
                  name="valor_parcela"
                  placeholder="0,00"
                  value={formData.valor_parcela}
                  inputMode="numeric"
                  onChange={(e) => setField('valor_parcela', maskMoney(e.target.value))}
                  leftIcon={<IconCoin size={14} />}
                />
                <Input
                  label="Parcelas totais"
                  name="parcelas_totais"
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex.: 48"
                  value={formData.parcelas_totais}
                  onChange={(e) => setField('parcelas_totais', e.target.value)}
                />
                <Input
                  label="Parcelas pagas"
                  name="parcelas_pagas"
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex.: 12"
                  value={formData.parcelas_pagas}
                  onChange={(e) => setField('parcelas_pagas', e.target.value)}
                />
                <Input
                  label="Parcelas atrasadas"
                  name="parcelas_atrasadas"
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex.: 3"
                  value={formData.parcelas_atrasadas}
                  onChange={(e) => setField('parcelas_atrasadas', e.target.value)}
                />
                <div>
                  {formData.valor_parcela.trim() && formData.parcelas_atrasadas.trim() && (
                    <p className="mt-6 text-[11px] font-semibold text-rose-600">
                      Saldo devedor (parcelas × atrasadas):{' '}
                      {formatCurrency(
                        parseMoney(formData.valor_parcela) *
                          Number(formData.parcelas_atrasadas || '0'),
                      )}
                    </p>
                  )}
                </div>
              </div>
            </SectionBody>
          )}
        </div>

        {/* ───── Peças ───── */}
        <div className={isOpen('pecas') ? 'border-b border-neutral-100' : ''}>
          <SectionHeader
            id="pecas"
            icon={IconTool}
            title="Peças que exigem reparo"
            subtitle={
              formData.pecas.length > 0
                ? `${formData.pecas.length} peça${formData.pecas.length === 1 ? '' : 's'} • ${formatCurrency(totalPecas)}`
                : 'Liste peças e valores de reparo (opcional)'
            }
            open={isOpen('pecas')}
            onToggle={() => toggleSection('pecas')}
          />
          {isOpen('pecas') && (
            <SectionBody>
              <div className="space-y-2">
                {formData.pecas.length === 0 && (
                  <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-3 py-3 text-xs text-neutral-500">
                    Nenhuma peça adicionada. Use o botão abaixo para listar
                    manualmente as peças que precisarão de reparo.
                  </div>
                )}

                {formData.pecas.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center"
                  >
                    <div className="relative flex-1">
                      <span
                        aria-hidden
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                      >
                        <IconTool size={13} />
                      </span>
                      <input
                        type="text"
                        value={p.nome}
                        onChange={(e) => {
                          const novo = [...formData.pecas]
                          novo[idx] = { ...novo[idx], nome: e.target.value }
                          setField('pecas', novo)
                        }}
                        placeholder="Nome da peça"
                        className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="relative w-full sm:w-40">
                      <span
                        aria-hidden
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                      >
                        <IconCoin size={13} />
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={p.valor}
                        onChange={(e) => {
                          const novo = [...formData.pecas]
                          novo[idx] = { ...novo[idx], valor: maskMoney(e.target.value) }
                          setField('pecas', novo)
                        }}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:bg-white focus:outline-none transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const novo = formData.pecas.filter((_, i) => i !== idx)
                        setField('pecas', novo)
                      }}
                      aria-label="Remover peça"
                      className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-ui cursor-pointer"
                    >
                      <IconTrash size={13} stroke={2.5} />
                    </button>
                  </div>
                ))}

                {formErrors.pecas && (
                  <p className="text-[11px] font-semibold text-rose-600">
                    {formErrors.pecas}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setField('pecas', [...formData.pecas, { nome: '', valor: '' }])
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:border-liberty/40 hover:bg-liberty/5 hover:text-liberty-deep transition-ui cursor-pointer"
                  >
                    <IconPlus size={12} stroke={2.5} />
                    Adicionar peça
                  </button>
                  {formData.pecas.length > 0 && (
                    <span className="text-[11px] font-semibold text-neutral-600">
                      Total estimado:{' '}
                      <strong className="text-liberty-deep">
                        {formatCurrency(totalPecas)}
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            </SectionBody>
          )}
        </div>

        {/* ───── Proposta ───── */}
        <div className={isOpen('proposta') ? 'border-b border-neutral-100' : ''}>
          <SectionHeader
            id="proposta"
            icon={IconCoin}
            title="Valor da Proposta"
            subtitle={
              valorPropostaNum && valorPropostaNum > 0
                ? formatCurrency(valorPropostaNum)
                : 'Valor comercial destacado na página 3 do PDF'
            }
            open={isOpen('proposta')}
            onToggle={() => toggleSection('proposta')}
            badge={completed('proposta') ? 'OK' : undefined}
          />
          {isOpen('proposta') && (
            <SectionBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Input
                    label="Valor da Proposta"
                    name="valor_proposta"
                    placeholder="0,00"
                    value={formData.valor_proposta}
                    inputMode="numeric"
                    onChange={(e) => setField('valor_proposta', maskMoney(e.target.value))}
                    leftIcon={<IconCoin size={14} />}
                    required
                  />
                  <FormattedMoneyHint value={formData.valor_proposta} />
                </div>
              </div>

              <div className="mt-4">
                <Textarea
                  label="Mensagem / interesse"
                  name="mensagem"
                  rows={3}
                  placeholder="Descreva o interesse do cliente neste veículo..."
                  value={formData.mensagem}
                  onChange={(e) => setField('mensagem', e.target.value)}
                  error={formErrors.mensagem}
                  required
                />
              </div>
            </SectionBody>
          )}
        </div>

        {/* ───── Proposta Prévia ───── */}
        <div className="">
          <SectionHeader
            id="previa"
            icon={IconCoin}
            title="Proposta Prévia"
            subtitle={
              propostaPreviaCalc.valor != null
                ? formatCurrency(propostaPreviaCalc.valor)
                : 'Calculada automaticamente'
            }
            open={isOpen('previa')}
            onToggle={() => toggleSection('previa')}
            badge={completed('previa') ? 'OK' : undefined}
          />
          {isOpen('previa') && (
            <SectionBody last>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3 text-xs text-neutral-700">
                  <p className="font-bold text-neutral-900">Cálculo automático</p>
                  <div className="flex items-center justify-between gap-2">
                    <span>1/2 Valor FIPE</span>
                    <span className="font-semibold">
                      {formatCurrency(propostaPreviaCalc.valorFipe / 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      Dívida em aberto ({propostaPreviaCalc.parcelasEmAberto} parcelas
                      restantes × parcela)
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(propostaPreviaCalc.dividaTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      % Quitação (desconto) do banco
                      {propostaPreviaCalc.bancoInfo ? ` — ${propostaPreviaCalc.bancoInfo.nome}` : ''}
                    </span>
                    <span className="font-semibold">
                      {propostaPreviaCalc.quitacaoPercent != null
                        ? `${propostaPreviaCalc.quitacaoPercent}%`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>− Quitação estimada (dívida × [1 − % quitação])</span>
                    <span className="font-semibold">
                      {propostaPreviaCalc.quitacaoEstimada != null
                        ? formatCurrency(propostaPreviaCalc.quitacaoEstimada)
                        : '—'}
                    </span>
                  </div>
                  {!propostaPreviaCalc.bancoInfo && (
                    <p className="flex items-start gap-1.5 pt-1 text-amber-700">
                      <IconAlertTriangle size={12} className="mt-0.5 shrink-0" stroke={2.2} />
                      Selecione um banco da lista no campo &quot;Banco / Financeira&quot; para
                      calcular a % de quitação.
                    </p>
                  )}
                  {propostaPreviaCalc.valorBruto != null && propostaPreviaCalc.valorBruto < 0 && (
                    <p className="flex items-start gap-1.5 pt-1 text-rose-700">
                      <IconAlertTriangle size={12} className="mt-0.5 shrink-0" stroke={2.2} />
                      Resultado negativo ({formatCurrency(propostaPreviaCalc.valorBruto)}) —
                      exibindo R$ 0,00.
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-liberty/20 bg-liberty/5 p-4 text-xs text-neutral-700">
                  <p className="font-bold text-liberty-deep">Valor da Proposta Prévia</p>
                  <p className="mt-1 text-2xl font-bold text-liberty-deep">
                    {propostaPreviaCalc.valor != null
                      ? formatCurrency(propostaPreviaCalc.valor)
                      : '—'}
                  </p>
                  <p className="mt-2">
                    Fórmula: metade do valor FIPE do veículo, menos a quitação estimada —
                    dívida em aberto (parcelas restantes × valor da parcela) × (1 − % de
                    quitação do banco), já que a % representa um desconto sobre a dívida.
                  </p>
                </div>
              </div>
            </SectionBody>
          )}
        </div>

        {/* Footer desktop */}
        <div className="hidden flex-col-reverse items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/50 px-6 py-4 sm:flex-row md:flex">
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
            <IconShieldCheck size={13} className="text-emerald-600" />
            Dados criptografados antes de salvar.
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/dashboard/propostas"
              className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer text-center"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-liberty px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer hover:bg-liberty-deep disabled:opacity-50"
            >
              {creating ? (
                <>
                  <svg className="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Salvando...
                </>
              ) : (
                <>
                  Continuar
                  <IconArrowRight size={14} stroke={2.5} />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      <div className="hidden gap-3 md:flex">
        <button
          type="button"
          onClick={() => setSummaryOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
        >
          <IconEye size={14} stroke={2.5} />
          Visualizar resumo da proposta
        </button>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur-md md:hidden"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSummaryOpen(true)}
              aria-label="Visualizar resumo da proposta"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
            >
              <IconEye size={18} stroke={2} />
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={creating}
              aria-label="Continuar"
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-liberty px-4 text-sm font-bold text-white shadow-sm transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer hover:bg-liberty-deep disabled:opacity-50"
            >
              {creating ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Salvando...
                </>
              ) : (
                <>
                  Continuar
                  <IconArrowRight size={16} stroke={2.5} />
                </>
              )}
            </button>
          </div>
        </div>,
        document.body,
      )}

      {typeof document !== 'undefined' && summaryOpen && createPortal(
        <div
          className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-sm"
          onClick={() => setSummaryOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Resumo da proposta"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-2xl border-t border-neutral-200 bg-white shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[80vh] md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border animate-[drawer-sheet-up_0.25s_cubic-bezier(0.16,1,0.3,1)_both]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 md:px-6 md:py-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-liberty/10 text-liberty">
                  <IconFileText size={18} stroke={2} />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-liberty">
                    Resumo
                  </p>
                  <h3 className="text-base font-bold text-neutral-950">
                    Prévia do que será gerado
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSummaryOpen(false)}
                aria-label="Fechar resumo"
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-ui cursor-pointer"
              >
                <IconChevronDown size={20} stroke={2} className="md:hidden" />
                <IconX size={18} stroke={2} className="hidden md:block" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5 md:max-h-[60vh]">
              <SummarySection title="Cliente" icon={IconUser}>
                <SummaryRow label="Nome" value={formData.nome} />
                <SummaryRow label="CPF" value={formData.cpf} />
                <SummaryRow label="Telefone" value={formData.telefone} />
                <SummaryRow label="E-mail" value={formData.email} />
                <SummaryRow label="Data" value={formData.cliente_data} />
                <SummaryRow label="Contrato" value={formData.numero_contrato || 'automático'} />
              </SummarySection>

              <SummarySection title="Veículo" icon={IconCar}>
                <SummaryRow
                  label="Marca/Modelo"
                  value={`${formData.veiculo_marca} ${formData.veiculo_modelo}`.trim()}
                />
                <SummaryRow label="Placa" value={formData.veiculo_placa} />
                <SummaryRow label="Ano" value={formData.veiculo_ano} />
                <SummaryRow
                  label="Valor FIPE"
                  value={
                    formData.veiculo_valor_fipe
                      ? formatCurrency(parseMoney(formData.veiculo_valor_fipe))
                      : null
                  }
                />
                <SummaryRow
                  label="Valor estimado da dívida"
                  value={
                    formData.valor_estimado_divida
                      ? formatCurrency(parseMoney(formData.valor_estimado_divida))
                      : null
                  }
                />
              </SummarySection>

              <SummarySection title="Pendências / Parcelas" icon={IconCalculator}>
                <SummaryRow label="IPVA" value={formData.valor_ipva ? formatCurrency(parseMoney(formData.valor_ipva)) : null} />
                <SummaryRow label="Licenciamento" value={formData.valor_licenciamento ? formatCurrency(parseMoney(formData.valor_licenciamento)) : null} />
                <SummaryRow label="Multas" value={formData.valor_multas ? formatCurrency(parseMoney(formData.valor_multas)) : null} />
                <SummaryRow label="Banco" value={formData.banco} />
                <SummaryRow label="Valor da parcela" value={formData.valor_parcela ? formatCurrency(parseMoney(formData.valor_parcela)) : null} />
                <SummaryRow
                  label="Parcelas"
                  value={
                    formData.parcelas_totais || formData.parcelas_pagas || formData.parcelas_atrasadas
                      ? `${formData.parcelas_pagas || '?'}/${formData.parcelas_totais || '?'} pagas • ${formData.parcelas_atrasadas || '0'} atrasadas`
                      : null
                  }
                />
              </SummarySection>

              <SummarySection title="Peças" icon={IconTool}>
                {formData.pecas.length === 0 ? (
                  <p className="text-[11px] text-neutral-500">Nenhuma peça listada.</p>
                ) : (
                  <>
                    <ul className="space-y-1 text-xs text-neutral-700">
                      {formData.pecas.slice(0, 6).map((p, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span className="truncate">{p.nome || '—'}</span>
                          <span className="font-semibold tabular-nums">
                            {p.valor ? formatCurrency(parseMoney(p.valor)) : '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {formData.pecas.length > 6 && (
                      <p className="mt-1 text-[11px] text-neutral-500">
                        +{formData.pecas.length - 6} outras…
                      </p>
                    )}
                    <p className="mt-1 text-[11px] font-bold text-liberty-deep">
                      Total: {formatCurrency(totalPecas)}
                    </p>
                  </>
                )}
              </SummarySection>

              <SummarySection title="Proposta" icon={IconCoin}>
                <SummaryRow
                  label="Valor da proposta"
                  value={
                    valorPropostaNum && valorPropostaNum > 0
                      ? formatCurrency(valorPropostaNum)
                      : null
                  }
                  accent
                />
                <SummaryRow label="Mensagem" value={formData.mensagem} />
              </SummarySection>

              <SummarySection title="Proposta Prévia" icon={IconCoin}>
                <SummaryRow
                  label="Valor da proposta prévia"
                  value={
                    propostaPreviaCalc.valor != null
                      ? formatCurrency(propostaPreviaCalc.valor)
                      : null
                  }
                  accent
                />
              </SummarySection>
            </div>

            <div className="border-t border-neutral-100 bg-neutral-50/50 px-5 py-3 md:px-6">
              <button
                type="button"
                onClick={() => setSummaryOpen(false)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
              >
                Voltar ao formulário
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {confirmOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/60 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeConfirm()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-t-2xl border border-neutral-200 bg-white shadow-2xl sm:rounded-2xl"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
          >
            <div className="relative border-b border-neutral-100 bg-linear-to-br from-liberty/10 via-white to-white px-5 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
              <button
                type="button"
                onClick={closeConfirm}
                aria-label="Fechar"
                className="absolute right-3 top-3 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-ui cursor-pointer"
              >
                <IconX size={18} stroke={2} />
              </button>
              <div className="flex items-start gap-3 pr-8">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-liberty text-white shadow-sm">
                  <IconFileText size={22} stroke={2} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-950">
                    Gerar PDF de autorização
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    O documento será gerado agora. Em seguida, escolha se a
                    proposta também deve ser cadastrada no sistema.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6" style={{ maxHeight: 'calc(100vh - 18rem)' }}>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
                    <IconFolderOpen size={12} />
                    Pasta de destino
                  </span>
                  {dirName ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      Selecionada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                      Padrão
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleEscolherPasta}
                    disabled={creating}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer disabled:opacity-50"
                  >
                    <IconFolderOpen size={14} className="text-neutral-500" />
                    {dirName ? 'Alterar pasta' : 'Escolher pasta'}
                  </button>
                  {dirName && (
                    <span
                      className="max-w-55 truncate text-[11px] font-medium text-neutral-500"
                      title={dirName}
                    >
                      Salvar em:{' '}
                      <strong className="text-neutral-700">{dirName}</strong>
                    </span>
                  )}
                  {!dirName && (
                    <span className="text-[11px] text-neutral-400">
                      Sem pasta selecionada, o PDF será baixado em Downloads.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="file-name-input"
                  className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500"
                >
                  Nome do arquivo PDF
                </label>
                <div className="relative">
                  <span
                    aria-hidden
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                  >
                    <IconFileText size={14} />
                  </span>
                  <input
                    id="file-name-input"
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="autorizacao-proposta"
                    className="w-full rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 focus:outline-none focus:border-liberty focus:ring-4 focus:ring-liberty/15 transition-[border-color,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] py-2.5 pl-10 pr-3.5 text-sm font-semibold text-neutral-900 placeholder:text-neutral-400 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={creating}
                  />
                </div>
                <p className="mt-1.5 text-xs text-neutral-500">
                  Será gerado como .pdf.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-neutral-100 bg-neutral-50/60 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={creating}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-liberty px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer hover:bg-liberty-deep disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <svg className="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Gerando...
                  </>
                ) : (
                  <>
                    <IconCheck size={14} stroke={2.5} />
                    Salvar proposta no sistema
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                disabled={creating}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-ui cursor-pointer disabled:opacity-50"
              >
                <IconX size={14} stroke={2.5} />
                Apenas gerar PDF (descartar do sistema)
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string
  value: string | null | undefined
  accent?: boolean
}) {
  const v = value && value.trim() ? value : null
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 py-1.5 last:border-0">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      <span
        className={
          'wrap-break-words text-right text-xs font-semibold ' +
          (accent ? 'text-liberty-deep' : 'text-neutral-900')
        }
      >
        {v ?? <span className="font-normal text-neutral-400">—</span>}
      </span>
    </div>
  )
}

function SummarySection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ size?: number; stroke?: number; className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <p className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
        <Icon size={12} className="text-neutral-400" />
        {title}
      </p>
      {children}
    </div>
  )
}
