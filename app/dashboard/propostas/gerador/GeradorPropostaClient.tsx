'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  IconFileText,
  IconSearch,
  IconDownload,
  IconCar,
  IconUser,
  IconMail,
  IconPhone,
  IconCoin,
  IconNote,
  IconCalendar,
  IconAlertCircle,
  IconArrowLeft,
  IconFolderOpen,
} from '@tabler/icons-react'
import { Breadcrumb, useToast, Input, Textarea, ConfirmDialog } from '@/app/components/ui'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { moneyFromNumber, parseMoney } from '@/utils/masks'
import type { Proposta } from '../actions'

interface GeradorPropostaClientProps {
  propostas: Proposta[]
}

interface DetailRowProps {
  label: string
  value?: string | null
  className?: string
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 py-2 last:border-0">
      <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-xs text-neutral-900 text-right max-w-[60%] break-words">
        {value && value.trim() ? value : <span className="text-neutral-400">—</span>}
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: Proposta['status'] }) {
  const styles =
    status === 'pendente'
      ? 'bg-amber-50 text-amber-800 border border-amber-200'
      : status === 'aceito'
        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
        : 'bg-rose-50 text-rose-800 border border-rose-200'
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${styles}`}
    >
      {status}
    </span>
  )
}

export default function GeradorPropostaClient({ propostas }: GeradorPropostaClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  
  // Estado para controle do modal profissional de permissão de pasta
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return propostas
    return propostas.filter((p) => {
      const clienteNome = p.nome || p.user_name || ''
      const veiculo = p.veiculos ? `${p.veiculos.marca} ${p.veiculos.modelo}` : ''
      return (
        clienteNome.toLowerCase().includes(term) ||
        veiculo.toLowerCase().includes(term) ||
        (p.email ?? '').toLowerCase().includes(term) ||
        (p.user_email ?? '').toLowerCase().includes(term)
      )
    })
  }, [propostas, search])

  const selected = useMemo(
    () => (selectedId ? propostas.find((p) => p.id === selectedId) ?? null : null),
    [propostas, selectedId],
  )

  // Pré-preenchimento derivado: prioriza `proposta_comercial` salvo; senão usa
  // `valor` ofertado. O form é não-controlado e é "remontado" via `key`
  // quando o cliente troca — assim não precisamos sincronizar estado em
  // useEffect, e mantemos os valores digitados em refs para enviar na hora.
  const defaultPropostaComercial = moneyFromNumber(
    selected?.proposta_comercial ?? selected?.valor ?? null,
  )
  const defaultCondicoes = selected?.condicoes ?? ''

  const formRef = useRef<HTMLDivElement>(null)

  // Estado do diretório selecionado para salvar o PDF
  const [dirHandle, setDirHandle] = useState<any>(null)
  const [dirName, setDirName] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('liberty_pdf_dir_name')
    }
    return null
  })

  const handleEscolherPasta = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        toast.info(
          'Seu navegador não oferece suporte à escolha de pastas nativa. O PDF será baixado na sua pasta de Downloads padrão.',
          'Recurso Indisponível'
        )
        return
      }
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      })
      setDirHandle(handle)
      setDirName(handle.name)
      localStorage.setItem('liberty_pdf_dir_name', handle.name)
      toast.success(`Pasta "${handle.name}" selecionada com sucesso!`, 'Pronto')
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error('Ocorreu um erro ao selecionar a pasta.', 'Falha')
      }
    }
  }

  const handleGerarPDF = async (id: string) => {
    setLoadingId(id)
    try {
      const comercialInput = formRef.current?.querySelector<HTMLInputElement>(
        'input[name="proposta_comercial"]',
      )
      const condicoesInput = formRef.current?.querySelector<HTMLTextAreaElement>(
        'textarea[name="condicoes"]',
      )
      const nomeInput = formRef.current?.querySelector<HTMLInputElement>(
        'input[name="nome_arquivo"]',
      )

      const comercialRaw = comercialInput?.value ?? ''
      const condicoesRaw = condicoesInput?.value ?? ''
      let nomeRaw = nomeInput?.value?.trim() ?? ''

      const params = new URLSearchParams()
      const comercialNum = parseMoney(comercialRaw)
      if (comercialRaw.trim() && comercialNum > 0) {
        params.set('proposta_comercial', comercialNum.toString())
      }
      if (condicoesRaw.trim()) {
        params.set('condicoes', condicoesRaw.trim())
      }
      const qs = params.toString()
      const url = `/api/propostas/${id}/pdf-autorizacao${qs ? `?${qs}` : ''}`

      const res = await fetch(url)
      if (!res.ok) {
        const errorText = await res.text()
        toast.error(errorText || 'Erro ao gerar PDF.', 'Falha no download')
        return
      }
      const blob = await res.blob()

      // Higienização simples do nome do arquivo
      if (!nomeRaw) {
        nomeRaw = `autorizacao-proposta-${id}`
      }
      if (!nomeRaw.toLowerCase().endsWith('.pdf')) {
        nomeRaw = `${nomeRaw}.pdf`
      }
      const fileName = nomeRaw.replace(/[^a-zA-Z0-9.\-_]/g, '_')

      // Se temos o suporte e o handle da pasta, salva diretamente lá
      if ('showDirectoryPicker' in window && (dirHandle || dirName)) {
        try {
          let activeHandle = dirHandle
          if (!activeHandle) {
            // Se o handle não está ativo nesta sessão, abrimos o ConfirmDialog profissional
            setPendingId(id)
            setConfirmOpen(true)
            setLoadingId(null)
            return
          }

          // Verificar permissões
          const options = { mode: 'readwrite' as const }
          if ((await activeHandle.queryPermission(options)) !== 'granted') {
            if ((await activeHandle.requestPermission(options)) !== 'granted') {
              throw new Error('Permissão negada pelo usuário')
            }
          }

          const fileHandle = await activeHandle.getFileHandle(fileName, { create: true })
          const writable = await fileHandle.createWritable()
          await writable.write(blob)
          await writable.close()
          toast.success(`PDF salvo diretamente em: ${activeHandle.name}/${fileName}`, 'Salvo com sucesso!')
          return
        } catch (err: any) {
          if (err.name === 'AbortError') {
            setLoadingId(null)
            return
          }
          console.error('Falha ao gravar arquivo via File System Access:', err)
          toast.info('Falha ao gravar na pasta escolhida. Iniciando download padrão...', 'Download alternativo')
        }
      }

      // Fallback: download padrão do navegador
      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = dlUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(dlUrl)
      toast.success('PDF de autorização baixado.', 'Pronto!')
    } catch {
      toast.error('Erro de conexão ao gerar o PDF.', 'Falha no download')
    } finally {
      setLoadingId(null)
    }
  }

  const handleConfirmarReautorizacao = async () => {
    if (!pendingId) return
    const id = pendingId
    setConfirmOpen(false)
    setPendingId(null)
    setLoadingId(id)
    try {
      toast.info('Selecione novamente a pasta para conceder a permissão de gravação nesta sessão.', 'Ação Necessária')
      const activeHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      })
      setDirHandle(activeHandle)
      setDirName(activeHandle.name)
      localStorage.setItem('liberty_pdf_dir_name', activeHandle.name)

      // Reprocessa a geração com o novo handle
      // Buscar inputs
      const comercialInput = formRef.current?.querySelector<HTMLInputElement>(
        'input[name="proposta_comercial"]',
      )
      const condicoesInput = formRef.current?.querySelector<HTMLTextAreaElement>(
        'textarea[name="condicoes"]',
      )
      const nomeInput = formRef.current?.querySelector<HTMLInputElement>(
        'input[name="nome_arquivo"]',
      )

      const comercialRaw = comercialInput?.value ?? ''
      const condicoesRaw = condicoesInput?.value ?? ''
      let nomeRaw = nomeInput?.value?.trim() ?? ''

      const params = new URLSearchParams()
      const comercialNum = parseMoney(comercialRaw)
      if (comercialRaw.trim() && comercialNum > 0) {
        params.set('proposta_comercial', comercialNum.toString())
      }
      if (condicoesRaw.trim()) {
        params.set('condicoes', condicoesRaw.trim())
      }
      const qs = params.toString()
      const url = `/api/propostas/${id}/pdf-autorizacao${qs ? `?${qs}` : ''}`

      const res = await fetch(url)
      if (!res.ok) {
        const errorText = await res.text()
        toast.error(errorText || 'Erro ao gerar PDF.', 'Falha no download')
        return
      }
      const blob = await res.blob()
      
      if (!nomeRaw) {
        nomeRaw = `autorizacao-proposta-${id}`
      }
      if (!nomeRaw.toLowerCase().endsWith('.pdf')) {
        nomeRaw = `${nomeRaw}.pdf`
      }
      const fileName = nomeRaw.replace(/[^a-zA-Z0-9.\-_]/g, '_')

      const fileHandle = await activeHandle.getFileHandle(fileName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(blob)
      await writable.close()
      toast.success(`PDF salvo diretamente em: ${activeHandle.name}/${fileName}`, 'Salvo com sucesso!')
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.info('Gravação cancelada. Iniciando download padrão...', 'Download alternativo')
        // Tenta fazer o download clássico em caso de recusa
        handleDownloadFallback(id)
      } else {
        console.error('Falha ao gravar arquivo via File System Access:', err)
        toast.info('Falha ao gravar na pasta escolhida. Iniciando download padrão...', 'Download alternativo')
        handleDownloadFallback(id)
      }
    } finally {
      setLoadingId(null)
    }
  }

  const handleDownloadFallback = async (id: string) => {
    try {
      const comercialInput = formRef.current?.querySelector<HTMLInputElement>(
        'input[name="proposta_comercial"]',
      )
      const condicoesInput = formRef.current?.querySelector<HTMLTextAreaElement>(
        'textarea[name="condicoes"]',
      )
      const nomeInput = formRef.current?.querySelector<HTMLInputElement>(
        'input[name="nome_arquivo"]',
      )
      const comercialRaw = comercialInput?.value ?? ''
      const condicoesRaw = condicoesInput?.value ?? ''
      let nomeRaw = nomeInput?.value?.trim() ?? ''

      const params = new URLSearchParams()
      const comercialNum = parseMoney(comercialRaw)
      if (comercialRaw.trim() && comercialNum > 0) {
        params.set('proposta_comercial', comercialNum.toString())
      }
      if (condicoesRaw.trim()) {
        params.set('condicoes', condicoesRaw.trim())
      }
      const qs = params.toString()
      const url = `/api/propostas/${id}/pdf-autorizacao${qs ? `?${qs}` : ''}`

      const res = await fetch(url)
      if (!res.ok) return
      const blob = await res.blob()
      const dlUrl = URL.createObjectURL(blob)
      
      if (!nomeRaw) {
        nomeRaw = `autorizacao-proposta-${id}`
      }
      if (!nomeRaw.toLowerCase().endsWith('.pdf')) {
        nomeRaw = `${nomeRaw}.pdf`
      }
      const fileName = nomeRaw.replace(/[^a-zA-Z0-9.\-_]/g, '_')

      const a = document.createElement('a')
      a.href = dlUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(dlUrl)
      toast.success('PDF de autorização baixado.', 'Pronto!')
    } catch (e) {
      console.error(e)
    }
  }

  const clienteNome = selected
    ? selected.nome || selected.user_name || 'Visitante'
    : ''
  const clienteEmail = selected
    ? selected.email || selected.user_email || 'Sem e-mail'
    : ''
  const clienteTelefone = selected ? selected.telefone || selected.user_phone : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Propostas', href: '/dashboard/propostas' },
              { label: 'Gerador' },
            ]}
          />
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950">
            Gerador de Proposta
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Selecione uma proposta, confirme se as informações batem e gere o PDF de
            autorização. O status da proposta <strong className="font-semibold text-neutral-700">não será alterado</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/propostas')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
        >
          <IconArrowLeft size={14} stroke={2.5} />
          Voltar
        </button>
      </div>

      {/* Grid 2 colunas */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,38%)_minmax(0,1fr)]">
        {/* COLUNA ESQUERDA: lista */}
        <div className="flex max-h-[calc(100vh-12rem)] flex-col rounded-xl border border-neutral-200 bg-neutral-50/40 overflow-hidden lg:sticky lg:top-8 lg:self-start">
          <div className="border-b border-neutral-200 bg-white p-3">
            <div className="relative">
              <IconSearch
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cliente, veículo..."
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50/50 pl-9 pr-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:bg-white focus:outline-none transition-colors"
              />
            </div>
            <p className="mt-2 text-[10px] text-neutral-500 uppercase tracking-wider font-bold">
              {filtered.length} {filtered.length === 1 ? 'proposta' : 'propostas'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
                <IconAlertCircle size={18} className="text-neutral-400" />
                Nenhuma proposta encontrada.
              </div>
            ) : (
              filtered.map((p) => {
                const nome = p.nome || p.user_name || 'Visitante'
                const modelo = p.veiculos ? `${p.veiculos.marca} ${p.veiculos.modelo}` : 'Veículo removido'
                const isSelected = selectedId === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white border-l-2 border-liberty shadow-xs'
                        : 'hover:bg-white/60 border-l-2 border-transparent'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-xs font-bold text-neutral-900 truncate">
                        {nome}
                      </span>
                      <StatusBadge status={p.status} />
                    </div>
                    <span className="text-[11px] text-neutral-600 truncate w-full">
                      {modelo}
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      {formatDateTime(p.created_at)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: detalhes */}
        <div className="flex flex-col rounded-xl border border-neutral-200 bg-white overflow-hidden">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-12 text-center text-sm text-neutral-500">
              <div className="space-y-2">
                <IconFileText size={32} className="mx-auto text-neutral-400" stroke={1.5} />
                <p className="font-semibold text-neutral-700">Nenhuma proposta selecionada</p>
                <p className="text-xs">Escolha uma proposta na lista à esquerda para revisar.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-5 space-y-4">
                {/* Cabeçalho do detalhe */}
                <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        Cliente
                      </span>
                      {selected.user_id ? (
                        <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded font-semibold">
                          Cadastrado
                        </span>
                      ) : (
                        <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded font-semibold">
                          Visitante
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 text-base font-bold text-neutral-900 flex items-center gap-2">
                      <IconUser size={15} className="text-neutral-400" />
                      {clienteNome}
                    </h3>
                    <div className="mt-1.5 space-y-1 text-xs text-neutral-600">
                      <div className="inline-flex items-center gap-1.5">
                        <IconMail size={12} className="text-neutral-400" />
                        {clienteEmail}
                      </div>
                      {clienteTelefone && (
                        <div className="inline-flex items-center gap-1.5 font-semibold text-neutral-800">
                          <IconPhone size={12} className="text-neutral-400" />
                          {clienteTelefone}
                        </div>
                      )}
                      {selected.cpf && (
                        <div className="inline-flex items-center gap-1.5 text-neutral-700">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">CPF:</span>
                          <span className="font-semibold">{selected.cpf}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>

                {/* Veículo */}
                <section className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-4">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest inline-flex items-center gap-1.5">
                    <IconCar size={12} /> Veículo de interesse
                  </span>
                  {selected.veiculos ? (
                    <div className="mt-1.5">
                      <h4 className="text-sm font-bold text-neutral-900">
                        {selected.veiculos.marca} {selected.veiculos.modelo}
                      </h4>
                      <DetailRow label="Preço sugerido" value={formatCurrency(selected.veiculos.preco)} />
                      <Link
                        href={`/veiculos/${selected.veiculo_id}`}
                        target="_blank"
                        className="inline-block text-xs font-semibold text-liberty hover:underline mt-1"
                      >
                        Ver veículo no site ↗
                      </Link>
                    </div>
                  ) : (
                    <p className="text-xs text-rose-600 mt-1.5">Veículo removido do catálogo.</p>
                  )}
                </section>

                {/* Dados da Proposta */}
                <section className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-4">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest inline-flex items-center gap-1.5">
                    <IconCoin size={12} /> Dados da proposta
                  </span>
                  <div className="mt-1.5">
                    <DetailRow
                      label="Valor ofertado"
                      value={selected.valor ? formatCurrency(selected.valor) : 'Sem oferta de preço'}
                    />
                    {selected.valor && selected.veiculos?.preco != null && (
                      <DetailRow
                        label="Diferença"
                        value={formatCurrency(selected.valor - selected.veiculos.preco)}
                      />
                    )}
                    <DetailRow
                      label="Enviada em"
                      value={formatDateTime(selected.created_at)}
                    />
                  </div>
                </section>

                {/* Mensagem */}
                <section className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-4">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest inline-flex items-center gap-1.5">
                    <IconNote size={12} /> Mensagem do cliente
                  </span>
                  <p className="mt-2 text-sm text-neutral-700 leading-relaxed whitespace-pre-line bg-white p-3 rounded-lg border border-neutral-100">
                    {selected.mensagem || '—'}
                  </p>
                </section>

                {/* Configuração do PDF */}
                <section
                  key={selected.id}
                  ref={formRef}
                  className="rounded-lg border border-liberty/30 bg-liberty/5 p-4 space-y-3"
                >
                  <span className="text-[10px] font-bold text-liberty uppercase tracking-widest inline-flex items-center gap-1.5">
                    <IconFileText size={12} /> Configuração do PDF
                  </span>
                  <Input
                    name="nome_arquivo"
                    label="Nome do Arquivo PDF"
                    defaultValue={`autorizacao-proposta-${selected.id.slice(0, 8).toUpperCase()}`}
                    placeholder="Nome do arquivo"
                    hint="Nome que o arquivo PDF terá ao ser gravado na pasta ou baixado."
                  />
                  <Input
                    name="proposta_comercial"
                    label="Proposta Comercial (R$)"
                    mask="money"
                    inputMode="numeric"
                    defaultValue={defaultPropostaComercial}
                    placeholder="0,00"
                    hint="Valor final que será exibido em destaque na página 3 do PDF. Pré-preenchido com o valor ofertado."
                  />
                  <Textarea
                    name="condicoes"
                    label="Condições / Observações"
                    rows={3}
                    defaultValue={defaultCondicoes}
                    placeholder="Ex.: Proposta válida por 5 dias, processo de 6 a 12 meses, etc."
                    hint="Texto livre exibido no bloco &quot;Condições e Garantias&quot; do PDF."
                  />
                </section>

                <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 pt-1">
                  <IconCalendar size={11} />
                  Documento gerado localmente para conferência.
                </div>
              </div>

              {/* Footer do detalhe */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/40 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleEscolherPasta}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
                  >
                    <IconFolderOpen size={14} className="text-neutral-500" />
                    {dirName ? 'Alterar pasta' : 'Escolher pasta'}
                  </button>
                  {dirName && (
                    <span className="text-[11px] text-neutral-500 font-medium truncate max-w-[150px]" title={dirName}>
                      Salvar em: <strong className="text-neutral-700">{dirName}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer"
                  >
                    Limpar seleção
                  </button>
                  <button
                    type="button"
                    disabled={loadingId === selected.id}
                    onClick={() => handleGerarPDF(selected.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-liberty px-4 py-2 text-xs font-bold text-white shadow-xs transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer hover:bg-liberty-deep disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingId === selected.id ? (
                      <>
                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Gerando...
                      </>
                    ) : (
                      <>
                        <IconDownload size={14} stroke={2.5} />
                        Gerar PDF de Autorização
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
          if (pendingId) {
            handleDownloadFallback(pendingId)
            setPendingId(null)
          }
        }}
        onConfirm={handleConfirmarReautorizacao}
        title="Confirmar Pasta de Destino"
        description={
          <p>
            Por motivos de segurança do navegador, precisamos que você reconfirme a pasta de
            destino <strong className="text-neutral-900 font-semibold">"{dirName}"</strong> para salvar o PDF diretamente.
            <br />
            <br />
            Se desejar baixar na pasta padrão de downloads do seu navegador, clique em Cancelar.
          </p>
        }
        confirmLabel="Confirmar Pasta"
        cancelLabel="Baixar Normal"
        tone="primary"
      />
    </div>
  )
}
