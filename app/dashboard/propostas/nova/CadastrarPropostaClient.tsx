'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  IconNote,
  IconShieldCheck,
  IconArrowRight,
  IconSparkles,
  IconTool,
  IconTrash,
  IconPlus,
} from '@tabler/icons-react'
import {
  Breadcrumb,
  useToast,
  Input,
  Textarea,
} from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'
import { parseMoney, onlyDigits } from '@/utils/masks'
import { validarCPF } from '@/utils/validadorCpf'
import type { VeiculoResumo } from '../actions'
import { createProposta } from '../actions'
import { VeiculoPicker } from './VeiculoPicker'

interface CadastrarPropostaClientProps {
  veiculos: VeiculoResumo[]
}

type FormData = {
  veiculo_id: string
  nome: string
  cpf: string
  telefone: string
  email: string
  valor: string
  mensagem: string
}

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

export default function CadastrarPropostaClient({ veiculos }: CadastrarPropostaClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [dirName, setDirName] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('liberty_pdf_dir_name')
    }
    return null
  })
  const [fileName, setFileName] = useState('')
  const [pecasConserto, setPecasConserto] = useState<
    Array<{ nome: string; valor: string; origem: 'manutencao' | 'manual' }>
  >([])
  const [loadingPecas, setLoadingPecas] = useState(false)
  const [pecasOrigemPuxada, setPecasOrigemPuxada] = useState(false)

  const pecasDaManutencao = useMemo(
    () => pecasConserto.filter((p) => p.origem === 'manutencao'),
    [pecasConserto],
  )

  const [formData, setFormData] = useState<FormData>({
    veiculo_id: '',
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    valor: '',
    mensagem: '',
  })
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const closeConfirm = useCallback(() => {
    if (creating) return
    setConfirmOpen(false)
    setFileName('')
  }, [creating])

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

  const buildPayload = () => {
    const valorNumerico = formData.valor.trim() ? parseMoney(formData.valor) : null
    const pecasPayload = pecasConserto
      .map((p) => {
        const nome = p.nome.trim()
        const valorNum = p.valor.trim() ? parseMoney(p.valor) : 0
        if (!nome) return null
        return { nome, valor: valorNum }
      })
      .filter((p): p is { nome: string; valor: number } => p !== null)
    return {
      veiculo_id: formData.veiculo_id,
      nome: formData.nome.trim(),
      cpf: onlyDigits(formData.cpf),
      telefone: formData.telefone.trim(),
      email: formData.email.trim(),
      valor: valorNumerico && valorNumerico > 0 ? valorNumerico : null,
      mensagem: formData.mensagem.trim(),
      status: 'pendente' as const,
      pecasConserto: pecasPayload,
    }
  }

  const persistPdfWithPayload = async (
    payload: ReturnType<typeof buildPayload>,
    finalName: string,
  ): Promise<{ ok: boolean; blob?: Blob }> => {
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
    return { ok: true, blob }
  }

  const handleConfirmSave = async () => {
    setCreating(true)
    try {
      const payload = buildPayload()
      const finalName = sanitizeFileName(fileName, `autorizacao-proposta-preview`)

      const persist = await persistPdfWithPayload(payload, finalName)
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
      router.push('/dashboard/propostas/gerador')
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
      const payload = buildPayload()
      const finalName = sanitizeFileName(fileName, `autorizacao-rascunho`)
      const persist = await persistPdfWithPayload(payload, finalName)
      if (persist.ok) {
        toast.info('Proposta descartada do banco. PDF gerado.', 'Não salvar')
      }
      setConfirmOpen(false)
      setFileName('')
      router.push('/dashboard/propostas/gerador')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado.'
      toast.error(message, 'Erro')
    } finally {
      setCreating(false)
    }
  }

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    if (formErrors[key]) setFormErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const carregarPecasDoVeiculo = useCallback(async (veiculoId: string) => {
    if (!veiculoId) return
    setLoadingPecas(true)
    try {
      const res = await fetch(`/api/veiculos/${veiculoId}/pecas-conserto`)
      if (!res.ok) {
        setPecasConserto([])
        setPecasOrigemPuxada(false)
        return
      }
      const data = (await res.json()) as { pecas?: Array<{ nome: string; valor: number }> }
      const pecas = Array.isArray(data.pecas) ? data.pecas : []
      // Substitui apenas as peças vindas da manutenção, preservando as manuais.
      setPecasConserto((prev) => {
        const manuais = prev.filter((p) => p.origem === 'manual')
        const auto = pecas.map((p) => ({
          nome: p.nome,
          valor: p.valor > 0
            ? p.valor.toFixed(2).replace('.', ',')
            : '',
          origem: 'manutencao' as const,
        }))
        return [...auto, ...manuais]
      })
      setPecasOrigemPuxada(pecas.length > 0)
    } catch {
      // silencioso — falhas de rede não devem travar a tela
    } finally {
      setLoadingPecas(false)
    }
  }, [])

  const handleVeiculoSelecionado = useCallback(
    (id: string) => {
      setField('veiculo_id', id)
      carregarPecasDoVeiculo(id)
    },
    [carregarPecasDoVeiculo, setField],
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Partial<Record<keyof FormData, string>> = {}

    if (!formData.veiculo_id) errors.veiculo_id = 'Selecione um veículo.'

    const nomeTrim = formData.nome.trim()
    if (!nomeTrim || nomeTrim.length < 2) {
      errors.nome = 'Informe o nome completo do cliente.'
    }

    const cpfDigits = onlyDigits(formData.cpf)
    if (!cpfDigits) {
      errors.cpf = 'Informe o CPF do cliente.'
    } else if (!validarCPF(cpfDigits)) {
      errors.cpf = 'CPF inválido.'
    }

    const telefoneDigits = onlyDigits(formData.telefone)
    if (!telefoneDigits || telefoneDigits.length < 10) {
      errors.telefone = 'Informe um telefone válido com DDD.'
    }

    const emailTrim = formData.email.trim()
    if (!emailTrim || !emailTrim.includes('@') || !emailTrim.includes('.')) {
      errors.email = 'Informe um e-mail válido.'
    }

    if (!formData.mensagem.trim()) {
      errors.mensagem = 'Descreva o interesse do cliente.'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      toast.error('Confira os campos destacados antes de continuar.', 'Formulário incompleto')
      return
    }

    setFormErrors({})
    setFileName(`autorizacao-proposta-${Date.now().toString(36).toUpperCase()}`)
    setConfirmOpen(true)
  }

  const selectedVeiculo = veiculos.find((v) => v.id === formData.veiculo_id)
  const valorNumerico = formData.valor.trim() ? parseMoney(formData.valor) : null

  const completion = useMemo(() => {
    const fields: (keyof FormData)[] = ['veiculo_id', 'nome', 'cpf', 'telefone', 'email', 'mensagem']
    const filled = fields.filter((f) => {
      const v = formData[f]
      return typeof v === 'string' ? v.trim().length > 0 : Boolean(v)
    }).length
    return Math.round((filled / fields.length) * 100)
  }, [formData])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Propostas', href: '/dashboard/propostas' },
              { label: 'Gerador', href: '/dashboard/propostas/gerador' },
              { label: 'Cadastrar' },
            ]}
          />
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-liberty/10 text-liberty">
              <IconSparkles size={22} stroke={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-neutral-950">
                Cadastrar nova proposta
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                Preencha os dados do cliente e selecione o veículo de interesse para
                gerar o PDF de autorização.
              </p>
            </div>
          </div>
        </div>
        <Link
          href="/dashboard/propostas/gerador"
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
        >
          <IconArrowLeft size={14} stroke={2.5} />
          Voltar para o Gerador
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-neutral-200 bg-white shadow-xs overflow-hidden"
        >
          <div className="border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-neutral-500">
                <IconUser size={14} />
                Dados do cliente
              </div>
              <span
                className={
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ' +
                  (completion === 100
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200')
                }
              >
                <span
                  className={
                    'h-1.5 w-1.5 rounded-full ' +
                    (completion === 100 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse')
                  }
                />
                {completion}% preenchido
              </span>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <section className="space-y-3">
              <header className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-400">
                <IconCar size={12} />
                Veículo
              </header>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 mb-1.5">
                  Veículo de interesse
                </label>
                {selectedVeiculo ? (
                  <div className="flex items-center gap-3 rounded-xl border border-liberty/30 bg-liberty/5 p-2.5">
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                      {selectedVeiculo.foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedVeiculo.foto}
                          alt={`${selectedVeiculo.marca} ${selectedVeiculo.modelo}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 text-neutral-400">
                          <IconCar size={20} stroke={1.5} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-neutral-900">
                        {selectedVeiculo.marca} {selectedVeiculo.modelo}
                        {selectedVeiculo.ano ? ` ${selectedVeiculo.ano}` : ''}
                      </p>
                      {selectedVeiculo.preco != null && (
                        <p className="mt-0.5 text-xs font-semibold text-liberty-deep">
                          {formatCurrency(selectedVeiculo.preco)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className={
                      'flex w-full items-center gap-3 rounded-xl border-2 border-dashed bg-neutral-50/40 px-4 py-3 text-left transition-[border-color,background-color] duration-200 cursor-pointer hover:bg-neutral-50 hover:border-liberty/40 ' +
                      (formErrors.veiculo_id
                        ? 'border-rose-500/60 bg-rose-50/40'
                        : 'border-neutral-300')
                    }
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-400 border border-neutral-200">
                      <IconCar size={18} stroke={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-neutral-700">
                        Escolher veículo
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Clique para ver os veículos disponíveis e selecione um.
                      </p>
                    </div>
                  </button>
                )}
                {formErrors.veiculo_id && (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600">
                    {formErrors.veiculo_id}
                  </p>
                )}
              </div>
            </section>

            <div className="h-px bg-neutral-100" />

            <section className="space-y-3">
              <header className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-400">
                <IconUser size={12} />
                Identificação
              </header>
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
              </div>
            </section>

            <div className="h-px bg-neutral-100" />

            <section className="space-y-3">
              <header className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-400">
                <IconPhone size={12} />
                Contato
              </header>
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
            </section>

            <div className="h-px bg-neutral-100" />

            <section className="space-y-3">
              <header className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-400">
                <IconCoin size={12} />
                Oferta
              </header>
              <div>
                <label
                  htmlFor="valor-input"
                  className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 mb-1.5"
                >
                  Valor ofertado <span className="text-neutral-400 normal-case font-semibold tracking-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <span
                    aria-hidden
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                  >
                    <IconCoin size={14} />
                  </span>
                  <input
                    id="valor-input"
                    type="text"
                    inputMode="numeric"
                    value={formData.valor}
                    onChange={(e) => setField('valor', maskMoney(e.target.value))}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 focus:outline-none focus:border-liberty focus:ring-4 focus:ring-liberty/15 transition-[border-color,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] py-2.5 pl-10 pr-3.5 text-sm font-semibold text-neutral-900 placeholder:text-neutral-400"
                  />
                </div>
                <p className="mt-1.5 text-xs text-neutral-500">
                  Se vazio, a proposta é registrada sem valor de oferta.
                </p>
              </div>
            </section>

            <div className="h-px bg-neutral-100" />

            <section className="space-y-3">
              <header className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-400">
                <IconNote size={12} />
                Mensagem
              </header>
              <Textarea
                label="Mensagem / interesse"
                name="mensagem"
                rows={5}
                placeholder="Descreva o interesse do cliente neste veículo..."
                value={formData.mensagem}
                onChange={(e) => setField('mensagem', e.target.value)}
                error={formErrors.mensagem}
                required
              />
            </section>

            <div className="h-px bg-neutral-100" />

            <section className="space-y-3">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-400 inline-flex items-center gap-2">
                  <IconTool size={12} />
                  Peças para conserto
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {pecasOrigemPuxada && pecasDaManutencao.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPecasConserto((prev) =>
                          prev.filter((p) => p.origem === 'manual'),
                        )
                        setPecasOrigemPuxada(false)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-bold text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 transition-ui cursor-pointer"
                    >
                      <IconX size={12} stroke={2.5} />
                      Descartar peças da manutenção
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setPecasConserto((prev) => [
                        ...prev,
                        { nome: '', valor: '', origem: 'manual' },
                      ])
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-bold text-neutral-700 hover:border-liberty/40 hover:bg-liberty/5 hover:text-liberty-deep transition-ui cursor-pointer"
                  >
                    <IconPlus size={12} stroke={2.5} />
                    Adicionar peça
                  </button>
                </div>
              </header>

              {loadingPecas ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-3 py-3 text-xs text-neutral-500">
                  <svg
                    className="animate-spin h-3 w-3"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  Carregando peças de manutenção do veículo…
                </div>
              ) : pecasOrigemPuxada && pecasDaManutencao.length > 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-700 inline-flex items-center gap-1.5">
                      <IconTool size={11} />
                      {pecasDaManutencao.length}{' '}
                      {pecasDaManutencao.length === 1
                        ? 'peça puxada da manutenção'
                        : 'peças puxadas da manutenção'}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {pecasDaManutencao.map((p, idx) => {
                      const realIdx = pecasConserto.findIndex(
                        (x) => x === p,
                      )
                      return (
                        <li
                          key={`auto-${idx}`}
                          className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-white p-3 sm:flex-row sm:items-center"
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
                              onChange={(e) =>
                                setPecasConserto((prev) =>
                                  prev.map((x, i) =>
                                    i === realIdx
                                      ? { ...x, nome: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                              placeholder="Nome da peça"
                              className="w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:bg-white focus:outline-none transition-colors"
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
                              onChange={(e) =>
                                setPecasConserto((prev) =>
                                  prev.map((x, i) =>
                                    i === realIdx
                                      ? {
                                          ...x,
                                          valor: maskMoney(e.target.value),
                                        }
                                      : x,
                                  ),
                                )
                              }
                              placeholder="0,00"
                              className="w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:bg-white focus:outline-none transition-colors"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setPecasConserto((prev) =>
                                prev.filter((_, i) => i !== realIdx),
                              )
                            }
                            aria-label="Remover peça"
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-ui cursor-pointer"
                          >
                            <IconTrash size={13} stroke={2.5} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  {pecasDaManutencao.length === 0 && null}
                </div>
              ) : pecasConserto.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  Nenhuma peça vinculada a este veículo nas manutenções. Você
                  pode listar manualmente as peças que precisarão de conserto.
                </p>
              ) : null}

              {pecasConserto.filter((p) => p.origem === 'manual').length > 0 && (
                <ul className="space-y-2">
                  {pecasConserto
                    .map((p, idx) => ({ p, idx }))
                    .filter(({ p }) => p.origem === 'manual')
                    .map(({ p, idx }) => (
                      <li
                        key={`manual-${idx}`}
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
                            onChange={(e) =>
                              setPecasConserto((prev) =>
                                prev.map((x, i) =>
                                  i === idx
                                    ? { ...x, nome: e.target.value }
                                    : x,
                                ),
                              )
                            }
                            placeholder="Nome da peça"
                            className="w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:bg-white focus:outline-none transition-colors"
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
                            onChange={(e) =>
                              setPecasConserto((prev) =>
                                prev.map((x, i) =>
                                  i === idx
                                    ? { ...x, valor: maskMoney(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                            placeholder="0,00"
                            className="w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:bg-white focus:outline-none transition-colors"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPecasConserto((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          aria-label="Remover peça"
                          className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-ui cursor-pointer"
                        >
                          <IconTrash size={13} stroke={2.5} />
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-neutral-100 bg-neutral-50/50 px-6 py-4">
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <IconShieldCheck size={13} className="text-emerald-600" />
              Dados criptografados antes de salvar.
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/dashboard/propostas/gerador"
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
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

        <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border border-liberty/20 bg-gradient-to-br from-liberty/5 via-white to-white p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-liberty">
                  Resumo da proposta
                </p>
                <h3 className="mt-1 text-lg font-bold text-neutral-950">
                  Prévia do que será gerado
                </h3>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-liberty/10 text-liberty">
                <IconFileText size={18} stroke={2} />
              </div>
            </div>

            <dl className="mt-4 space-y-2.5 text-sm">
              <SummaryRow
                label="Veículo"
                value={
                  selectedVeiculo
                    ? `${selectedVeiculo.marca} ${selectedVeiculo.modelo}${
                        selectedVeiculo.ano ? ` ${selectedVeiculo.ano}` : ''
                      }`
                    : 'Selecione um veículo'
                }
              />
              <SummaryRow
                label="Preço sugerido"
                value={selectedVeiculo ? formatCurrency(selectedVeiculo.preco) : '—'}
              />
              <SummaryRow label="Cliente" value={formData.nome || '—'} />
              <SummaryRow label="CPF" value={formData.cpf || '—'} />
              <SummaryRow label="Telefone" value={formData.telefone || '—'} />
              <SummaryRow label="E-mail" value={formData.email || '—'} />
              <SummaryRow
                label="Valor ofertado"
                value={valorNumerico ? formatCurrency(valorNumerico) : '—'}
                accent={Boolean(valorNumerico)}
              />
            </dl>

            <div className="mt-5 rounded-lg border border-neutral-200 bg-white p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
                Mensagem
              </p>
              <p className="mt-1.5 text-xs text-neutral-700 leading-relaxed whitespace-pre-line line-clamp-5">
                {formData.mensagem || 'Nenhuma mensagem informada.'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <IconShieldCheck size={18} stroke={2} />
              </div>
              <div className="text-xs text-neutral-600 leading-relaxed">
                <p className="font-bold text-neutral-900">Privacidade</p>
                <p className="mt-0.5">
                  O CPF é criptografado antes de ser armazenado. O e-mail e telefone são
                  usados apenas para contato comercial.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <VeiculoPicker
        key={pickerOpen ? 'open' : 'closed'}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        veiculos={veiculos}
        value={formData.veiculo_id || null}
        onSelect={handleVeiculoSelecionado}
      />

      {confirmOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 backdrop-blur-sm p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeConfirm()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden"
          >
            <div className="relative bg-gradient-to-br from-liberty/10 via-white to-white px-6 pt-6 pb-5 border-b border-neutral-100">
              <button
                type="button"
                onClick={closeConfirm}
                aria-label="Fechar"
                className="absolute right-3 top-3 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-ui cursor-pointer"
              >
                <IconX size={18} stroke={2} />
              </button>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-liberty text-white shadow-sm">
                  <IconFileText size={22} stroke={2} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-950">
                    Gerar PDF de autorização
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    O documento será gerado agora. Em seguida, escolha se a proposta
                    também deve ser cadastrada no sistema.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 inline-flex items-center gap-1.5">
                    <IconFolderOpen size={12} />
                    Pasta de destino
                  </span>
                  {dirName ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      Selecionada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
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
                      className="text-[11px] text-neutral-500 font-medium truncate max-w-[220px]"
                      title={dirName}
                    >
                      Salvar em: <strong className="text-neutral-700">{dirName}</strong>
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
                  className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 mb-1.5"
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
                    className="w-full rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 focus:outline-none focus:border-liberty focus:ring-4 focus:ring-liberty/15 transition-[border-color,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] py-2.5 pl-10 pr-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={creating}
                  />
                </div>
                <p className="mt-1.5 text-xs text-neutral-500">
                  Será gerado como .pdf.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-neutral-100 bg-neutral-50/60 px-6 py-4">
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={creating}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-liberty px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer hover:bg-liberty-deep disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
      <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 shrink-0">
        {label}
      </span>
      <span
        className={
          'text-right text-sm font-semibold break-words ' +
          (accent ? 'text-liberty-deep' : 'text-neutral-900')
        }
      >
        {value && value.trim() ? value : <span className="text-neutral-400 font-normal">—</span>}
      </span>
    </div>
  )
}
