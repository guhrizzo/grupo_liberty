'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconUserSearch,
  IconTableImport,
  IconFileText,
  IconBrandWhatsapp,
  IconMail,
  IconBrandGoogleMaps,
  IconBrandWaze,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconFilter,
  IconFilterOff,
  IconClipboardCheck,
  IconChevronDown,
} from '@tabler/icons-react'
import {
  Button,
  Input,
  Textarea,
  Modal,
  THead,
  TBody,
  TR,
  TH,
  TD,
  ConfirmDialog,
  Select,
  useToast,
} from '@/app/components/ui'
import { useDebounce } from '@/utils/useDebounce'
import { formatCurrency, formatDate } from '@/utils/format'
import { maskCPFCNPJ, maskMoney, maskPhone, maskPlate, moneyFromNumber, parseMoney } from '@/utils/masks'
import {
  salvarProspeccao,
  importarProspeccoes,
  getProspeccoes,
  deleteProspeccao,
  deleteProspeccoes,
  enviarOfertaEmail,
} from './prospeccao-actions'
import { PROSPECCAO_COLUNAS, parseLinhasPlanilha } from './prospeccao-parse'
import {
  CAMPO_PENDENTE_LABEL,
  pendenciasParaProposta,
  emailValido,
  type CampoPendente,
} from './prospeccao-proposta'
import {
  aplicarFiltros,
  colunaNumerica,
  ordenar,
  totalFiltrosAtivos,
  valoresDistintos,
  type ColunaFiltro,
  type Filtros,
  type Ordem,
} from './prospeccao-filtro'
import { FiltroColunaBotao, FiltroLista } from './FiltroColuna'
import { DataRetorno, UltimaVisita, VisitasModal } from './VisitaLead'
import type { Prospeccao, ProspeccaoInput } from './types'

type Chave = keyof ProspeccaoInput
type FormState = Record<Chave, string>

const MONEY: Chave[] = ['valorEntrada', 'valorFinanciado', 'valorParcela']
const INTS: Chave[] = ['parcelasContrato', 'parcelasPagas']
const PHONES: Chave[] = ['telefone1', 'telefone2', 'telefone3']

const PLACEHOLDERS: Record<Chave, string> = {
  numeroProcesso: '0000000-00.0000.0.00.0000',
  comarca: 'Ex: São Manuel',
  nomeExecutado: 'Nome completo do executado',
  cpfCnpj: '000.000.000-00',
  banco: 'Ex: Banco Votorantim S.A.',
  veiculo: 'Ex: Fiat Palio Attractive 1.4 8V Evo 4P',
  anoModelo: '2013/2014',
  placa: 'ABC1D23',
  valorEntrada: '0,00',
  valorFinanciado: '0,00',
  parcelasContrato: 'Ex: 60',
  parcelasPagas: 'Ex: 29',
  ultimoMesPago: 'Ex: jan/26',
  valorParcela: '0,00',
  telefone1: '(00) 00000-0000',
  telefone2: '(00) 00000-0000',
  telefone3: '(00) 00000-0000',
  renegociacaoEm: 'Ex: 15/02/2026',
  email: 'nome@exemplo.com',
  endereco: 'Rua, número, bairro, cidade/UF, CEP',
}

const PAGE_SIZE = 30

/** Colunas da tabela: as da planilha + as da última visita, logo após o nome. */
const COLUNAS_TABELA: { key: ColunaFiltro; label: string }[] = PROSPECCAO_COLUNAS.flatMap((c) =>
  c.key === 'nomeExecutado'
    ? [c, { key: 'ultimaVisita' as const, label: 'Última visita' }, { key: 'retornoEm' as const, label: 'Retornar em' }]
    : [c],
)

function formVazio(): FormState {
  return Object.fromEntries(PROSPECCAO_COLUNAS.map(({ key }) => [key, ''])) as FormState
}

function formDe(p: Prospeccao): FormState {
  const f = formVazio()
  for (const { key } of PROSPECCAO_COLUNAS) {
    const v = p[key]
    if (MONEY.includes(key)) f[key] = moneyFromNumber(v as number | null)
    else f[key] = v == null ? '' : String(v)
  }
  return f
}

function mascarar(key: Chave, v: string): string {
  if (MONEY.includes(key)) return maskMoney(v)
  if (INTS.includes(key)) return v.replace(/\D/g, '').slice(0, 4)
  if (key === 'cpfCnpj') return maskCPFCNPJ(v)
  if (key === 'placa') return maskPlate(v)
  if (PHONES.includes(key)) return maskPhone(v)
  return v
}

/** Valor da célula como aparece na planilha. */
function celula(p: ProspeccaoInput, key: Chave): string {
  const v = p[key]
  if (v === null || v === '') return 'Não consta'
  if (MONEY.includes(key)) return formatCurrency(v as number)
  if (INTS.includes(key)) return `${v} parcelas`
  return String(v)
}

/**
 * Número de celular BR no formato do wa.me (55 + DDD + 9 dígitos), ou null
 * se não for um celular válido. Aceita número com 55/0 na frente e celular
 * antigo de 8 dígitos (acrescenta o 9). Fixo não tem botão.
 */
function numeroWhatsapp(telefone: string): string | null {
  let d = telefone.replace(/\D/g, '')
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  // 0 de operadora antes do DDD (014 99876-5432).
  if (d.length === 12 && d.startsWith('0')) d = d.slice(1)
  if (!/^[1-9]{2}/.test(d)) return null
  if (d.length === 10 && /[6-9]/.test(d[2])) d = `${d.slice(0, 2)}9${d.slice(2)}`
  if (d.length !== 11 || d[2] !== '9' || !/^[1-9]{2}$/.test(d.slice(0, 2))) return null
  return `55${d}`
}

function linkWhatsapp(numero: string, nome: string): string {
  const primeiroNome = nome.split(/\s+/)[0] ?? ''
  const nomeFmt = primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase()
  const texto = encodeURIComponent(`Olá, ${nomeFmt}! Tudo bem? Aqui é da Liberty Car.`)
  return `https://wa.me/${numero}?text=${texto}`
}

/** Primeiro celular com WhatsApp válido entre os três telefones. */
function primeiroWhatsapp(p: Prospeccao): string | null {
  for (const t of [p.telefone1, p.telefone2, p.telefone3]) {
    const n = numeroWhatsapp(t)
    if (n) return n
  }
  return null
}

/** Links de navegação para o endereço (busca por texto nos dois apps). */
function linksMapa(endereco: string): { maps: string; waze: string } {
  const q = encodeURIComponent(endereco)
  return {
    maps: `https://www.google.com/maps/search/?api=1&query=${q}`,
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
  }
}

/** Botões Maps / Waze para o endereço (tabela e cartões). */
function LinksMapa({ endereco, grande }: { endereco: string; grande?: boolean }) {
  const { maps, waze } = linksMapa(endereco)
  const tam = grande ? ' !px-2.5 !py-1.5 !text-xs' : ''
  return (
    <div className="mt-1 flex gap-1.5">
      <a
        href={maps}
        target="_blank"
        rel="noopener noreferrer"
        title="Abrir no Google Maps"
        className={"inline-flex items-center gap-1 rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600 transition-colors adobe-dark:border-adobe-line adobe-dark:text-adobe-text-md hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 adobe-dark:hover:border-sky-400/50 adobe-dark:hover:bg-sky-500/20 adobe-dark:hover:text-sky-200" + tam}
      >
        <IconBrandGoogleMaps size={grande ? 14 : 12} />
        Maps
      </a>
      <a
        href={waze}
        target="_blank"
        rel="noopener noreferrer"
        title="Abrir no Waze"
        className={"inline-flex items-center gap-1 rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600 transition-colors adobe-dark:border-adobe-line adobe-dark:text-adobe-text-md hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 adobe-dark:hover:border-cyan-400/50 adobe-dark:hover:bg-cyan-500/20 adobe-dark:hover:text-cyan-200" + tam}
      >
        <IconBrandWaze size={grande ? 14 : 12} />
        Waze
      </a>
    </div>
  )
}

/** Telefone: vira link de WhatsApp quando é celular válido. */
function Telefone({ valor, nome }: { valor: string; nome: string }) {
  const numero = numeroWhatsapp(valor)
  if (!numero) return <>{valor || 'Não consta'}</>
  return (
    <a
      href={linkWhatsapp(numero, nome)}
      target="_blank"
      rel="noopener noreferrer"
      title="Conversar no WhatsApp"
      className="inline-flex items-center gap-1.5 font-medium text-emerald-700 hover:underline"
    >
      <IconBrandWhatsapp size={14} className="shrink-0" />
      {valor}
    </a>
  )
}

function primeiroNomeFmt(nome: string): string {
  const n = nome.split(/\s+/)[0] ?? ''
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
}

function assuntoPadrao(p: ProspeccaoInput): string {
  const curto = p.veiculo.split(/\s+/).slice(0, 2).join(' ')
  return curto
    ? `Proposta de compra do seu ${curto} | Liberty Car`
    : 'Proposta de compra do seu veículo | Liberty Car'
}

/** Texto inicial do e-mail de oferta; o valor entra formatado. */
function mensagemPadrao(p: ProspeccaoInput, valor: string): string {
  const veiculo = [p.veiculo || 'veículo', p.anoModelo ? `(${p.anoModelo})` : '']
    .filter(Boolean)
    .join(' ')
  const valorTxt = valor ? `R$ ${valor}` : 'R$ ____'
  const banco = p.banco
    ? ` Cuidamos de toda a negociação da quitação do financiamento junto ao ${p.banco}, sem burocracia para você.`
    : ''
  return [
    `Olá, ${primeiroNomeFmt(p.nomeExecutado)}!`,
    `Somos da Liberty Car e temos interesse em comprar o seu ${veiculo}.`,
    `Podemos oferecer ${valorTxt} pelo veículo.${banco}`,
    'Se tiver interesse, é só responder este e-mail ou nos chamar no WhatsApp.',
    'Atenciosamente,\nEquipe Liberty Car',
  ].join('\n\n')
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="mt-0.5 break-words text-[13px] text-neutral-800">{children}</dd>
    </div>
  )
}

function CartaoProspeccao({
  p,
  selecionado,
  onSelecionar,
  onVisita,
  acoes,
}: {
  p: Prospeccao
  selecionado: boolean
  onSelecionar: () => void
  onVisita: () => void
  acoes: React.ReactNode
}) {
  const ou = (v: string) => v || 'Não consta'
  const parcelas =
    p.parcelasPagas != null || p.parcelasContrato != null
      ? `${p.parcelasPagas ?? '?'} de ${p.parcelasContrato ?? '?'} pagas`
      : 'Não consta'
  const telefones = [p.telefone1, p.telefone2, p.telefone3].filter(Boolean)
  // Recolhido por padrão: só o resumo; a setinha abre os detalhes.
  const [aberto, setAberto] = useState(false)
  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-xs ${
        selecionado ? 'border-rose-300 bg-rose-50/50' : 'border-neutral-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selecionado}
          onChange={onSelecionar}
          aria-label={`Selecionar ${p.nomeExecutado}`}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-liberty-deep"
        />
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-sm font-bold text-neutral-900">{p.nomeExecutado}</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            {p.cpfCnpj || 'CPF não consta'}
            {p.comarca ? ` · ${p.comarca}` : ''}
          </p>
          {aberto && p.numeroProcesso && (
            <p className="mt-0.5 break-all font-mono text-[11px] text-neutral-400">{p.numeroProcesso}</p>
          )}
          {!aberto && (
            <p className="mt-1 truncate text-xs font-semibold text-neutral-700">
              {p.veiculo || 'Veículo não consta'}
              {p.placa ? <span className="font-mono font-bold text-neutral-500"> · {p.placa}</span> : null}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-label={aberto ? `Recolher ${p.nomeExecutado}` : `Ver detalhes de ${p.nomeExecutado}`}
          className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 cursor-pointer"
        >
          <IconChevronDown size={18} stroke={2.2} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {aberto && (
      <>
      <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2.5">
        <p className="break-words text-[13px] font-semibold text-neutral-900">
          {p.veiculo || 'Veículo não consta'}
          {p.anoModelo ? <span className="font-normal text-neutral-500"> · {p.anoModelo}</span> : null}
        </p>
        {p.placa && (
          <span className="mt-1.5 inline-block rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-neutral-800">
            {p.placa}
          </span>
        )}
        <p className="mt-0.5 break-words text-xs text-neutral-500">{ou(p.banco)}</p>
      </div>

      <div className="mt-3 rounded-lg border border-neutral-200 px-3 py-2.5">
        <dl className="grid grid-cols-2 gap-x-3">
          <Campo label="Última visita">
            <UltimaVisita p={p} />
          </Campo>
          <Campo label="Retornar em">
            {p.visitas[0]?.retornoEm ? <DataRetorno data={p.visitas[0].retornoEm} /> : '—'}
          </Campo>
        </dl>
        <Button
          size="sm"
          variant="secondary"
          onClick={onVisita}
          leftIcon={<IconClipboardCheck size={13} />}
          className="mt-2.5 w-full"
        >
          Registrar visita
        </Button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
        <Campo label="Financiado">{celula(p, 'valorFinanciado')}</Campo>
        <Campo label="Entrada">{celula(p, 'valorEntrada')}</Campo>
        <Campo label="Parcela">{celula(p, 'valorParcela')}</Campo>
        <Campo label="Parcelas">{parcelas}</Campo>
        <Campo label="Último mês pago">{ou(p.ultimoMesPago)}</Campo>
        <Campo label="Renegociação">{ou(p.renegociacaoEm)}</Campo>
      </dl>

      <dl className="mt-3 space-y-2.5 border-t border-neutral-100 pt-3">
        <Campo label="Telefones">
          {telefones.length === 0 ? (
            'Não consta'
          ) : (
            <span className="flex flex-col gap-1">
              {telefones.map((t, i) => (
                <Telefone key={i} valor={t} nome={p.nomeExecutado} />
              ))}
            </span>
          )}
        </Campo>
        <Campo label="E-mail">
          <span className="break-all">{ou(p.email)}</span>
        </Campo>
        <Campo label="Endereço">
          {p.endereco ? (
            <>
              {p.endereco}
              <LinksMapa endereco={p.endereco} grande />
            </>
          ) : (
            'Não consta'
          )}
        </Campo>
      </dl>

      <div className="mt-4 flex items-stretch gap-2 border-t border-neutral-100 pt-3">{acoes}</div>
      </>
      )}
    </article>
  )
}

export default function ProspeccaoSection({
  initialProspeccoes,
  podeGerarProposta,
  titulo = 'Prospecção de clientes',
  usuarioUid,
  podeExcluirVisitas = false,
}: {
  initialProspeccoes: Prospeccao[]
  /** Sem acesso à aba Propostas, o botão "Proposta" não aparece. */
  podeGerarProposta: boolean
  titulo?: string
  /** Quem está logado — pode excluir as visitas que registrou. */
  usuarioUid: string
  /** ADM supremo: exclui visita de qualquer vendedor. */
  podeExcluirVisitas?: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [itens, setItens] = useState<Prospeccao[]>(initialProspeccoes)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [page, setPage] = useState(1)

  // Filtro estilo Excel por coluna + classificação (não ficam salvos).
  const [filtros, setFiltros] = useState<Filtros>({})
  const [ordem, setOrdem] = useState<Ordem>(null)
  // Celular: os filtros abrem num modal, escolhendo a coluna.
  const [filtrosMobileOpen, setFiltrosMobileOpen] = useState(false)
  const [colunaMobile, setColunaMobile] = useState<ColunaFiltro>('nomeExecutado')

  // Tela cheia: a lista cobre o painel inteiro (menu lateral incluso).
  const [telaCheia, setTelaCheia] = useState(false)
  useEffect(() => {
    if (!telaCheia) return
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      // Esc com modal aberto fecha só o modal.
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setTelaCheia(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflowAnterior
      document.removeEventListener('keydown', onKey)
    }
  }, [telaCheia])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Prospeccao | null>(null)
  const [form, setForm] = useState<FormState>(formVazio)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Prospeccao | null>(null)
  // Resultado de visita do vendedor (checklist + histórico).
  const [visitasDe, setVisitasDe] = useState<Prospeccao | null>(null)
  // Seleção múltipla para exclusão em lote.
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set())
  const [confirmLote, setConfirmLote] = useState<'selecionados' | 'tudo' | null>(null)

  // E-mail de oferta pelo veículo.
  const [emailDe, setEmailDe] = useState<Prospeccao | null>(null)
  const [ofertaValor, setOfertaValor] = useState('')
  const [ofertaAssunto, setOfertaAssunto] = useState('')
  const [ofertaMensagem, setOfertaMensagem] = useState('')
  // Enquanto o texto não for editado à mão, ele acompanha o valor digitado.
  const [mensagemEditada, setMensagemEditada] = useState(false)

  // Gerar proposta: se faltar dado obrigatório do formulário de proposta,
  // pede aqui (e salva na prospecção) antes de abrir /dashboard/propostas/nova.
  const [propostaDe, setPropostaDe] = useState<Prospeccao | null>(null)
  const [pendentes, setPendentes] = useState<{ campo: CampoPendente; motivo: string }[]>([])
  const [propostaForm, setPropostaForm] = useState<Record<CampoPendente, string>>({
    cpfCnpj: '',
    telefone1: '',
    email: '',
    veiculo: '',
  })

  const [importOpen, setImportOpen] = useState(false)
  const [importTexto, setImportTexto] = useState('')
  const leitura = useMemo(() => parseLinhasPlanilha(importTexto), [importTexto])
  const previa = leitura.registros

  function abrirNovo() {
    setEditing(null)
    setForm(formVazio())
    setFormOpen(true)
  }

  function abrirEdicao(p: Prospeccao) {
    setEditing(p)
    setForm(formDe(p))
    setFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    if (!form.nomeExecutado.trim()) {
      toast.error('Informe o nome do executado.')
      return
    }
    setSubmitting(true)
    try {
      const res = await salvarProspeccao(editing?.id ?? null, form)
      if (res.error || !res.prospeccao) {
        toast.error(res.error || 'Erro ao salvar.')
        return
      }
      const salvo = res.prospeccao
      setItens((prev) =>
        editing ? prev.map((x) => (x.id === salvo.id ? salvo : x)) : [salvo, ...prev],
      )
      if (!editing) setPage(1)
      toast.success(res.success || 'Salvo.')
      setFormOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleImport() {
    if (submitting || previa.length === 0) return
    setSubmitting(true)
    try {
      const res = await importarProspeccoes(previa)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(res.success || 'Importado.')
      setImportOpen(false)
      setImportTexto('')
      setPage(1)
      setItens(await getProspeccoes())
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(p: Prospeccao) {
    setConfirmDelete(null)
    setItens((prev) => prev.filter((x) => x.id !== p.id))
    setSelecionados((prev) => {
      const next = new Set(prev)
      next.delete(p.id)
      return next
    })
    const res = await deleteProspeccao(p.id)
    if (res.error) {
      toast.error(res.error)
      setItens((prev) => [p, ...prev])
    } else {
      toast.success(res.success || 'Removido.')
    }
    router.refresh()
  }

  function abrirEmail(p: Prospeccao) {
    const valor = moneyFromNumber(p.ultimoEmailValor)
    setOfertaValor(valor)
    setOfertaAssunto(assuntoPadrao(p))
    setOfertaMensagem(mensagemPadrao(p, valor))
    setMensagemEditada(false)
    setEmailDe(p)
  }

  function mudarValorOferta(v: string) {
    const valor = maskMoney(v)
    setOfertaValor(valor)
    if (!mensagemEditada && emailDe) setOfertaMensagem(mensagemPadrao(emailDe, valor))
  }

  async function handleEnviarEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!emailDe || submitting) return
    const valor = parseMoney(ofertaValor)
    if (!valor || valor <= 0) {
      toast.error('Informe o valor da oferta.')
      return
    }
    if (!ofertaMensagem.trim() || !ofertaAssunto.trim()) {
      toast.error('Preencha o assunto e a mensagem.')
      return
    }
    if (ofertaMensagem.includes('R$ ____')) {
      toast.error('A mensagem ainda tem o valor em branco (R$ ____).')
      return
    }
    setSubmitting(true)
    try {
      const res = await enviarOfertaEmail(emailDe.id, {
        valor,
        assunto: ofertaAssunto,
        mensagem: ofertaMensagem,
      })
      if (res.error || !res.prospeccao) {
        toast.error(res.error || 'Erro ao enviar.')
        return
      }
      const salvo = res.prospeccao
      setItens((prev) => prev.map((x) => (x.id === salvo.id ? salvo : x)))
      setEmailDe(null)
      toast.success(res.success || 'E-mail enviado.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  function abrirProposta(p: Prospeccao) {
    router.push(`/dashboard/propostas/nova?prospeccao=${encodeURIComponent(p.id)}`)
  }

  function gerarProposta(p: Prospeccao) {
    const pend = pendenciasParaProposta(p)
    if (pend.length === 0) {
      abrirProposta(p)
      return
    }
    setPendentes(pend)
    setPropostaForm({
      cpfCnpj: p.cpfCnpj,
      telefone1: p.telefone1,
      email: p.email,
      veiculo: p.veiculo,
    })
    setPropostaDe(p)
  }

  async function handleCompletarProposta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!propostaDe || submitting) return
    // salvarProspeccao só lê as colunas da planilha; id/datas são ignorados.
    const atualizado = { ...propostaDe, ...propostaForm }
    const aindaFalta = pendenciasParaProposta(atualizado)
    if (aindaFalta.length > 0) {
      setPendentes(aindaFalta)
      toast.error('Ainda faltam dados: ' + aindaFalta.map((x) => CAMPO_PENDENTE_LABEL[x.campo]).join(', ') + '.')
      return
    }
    setSubmitting(true)
    try {
      const res = await salvarProspeccao(propostaDe.id, atualizado)
      if (res.error || !res.prospeccao) {
        toast.error(res.error || 'Erro ao salvar.')
        return
      }
      const salvo = res.prospeccao
      setItens((prev) => prev.map((x) => (x.id === salvo.id ? salvo : x)))
      setPropostaDe(null)
      toast.success('Dados salvos na prospecção. Abrindo a proposta...')
      abrirProposta(salvo)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  function alternar(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDeleteLote() {
    const modo = confirmLote
    setConfirmLote(null)
    if (!modo || submitting) return
    const ids = modo === 'tudo' ? itens.map((p) => p.id) : [...selecionados]
    if (ids.length === 0) return
    setSubmitting(true)
    try {
      const res = await deleteProspeccoes(ids)
      if (res.error) {
        toast.error(res.error)
        return
      }
      const removidos = new Set(ids)
      setItens((prev) => prev.filter((p) => !removidos.has(p.id)))
      setSelecionados(new Set())
      setPage(1)
      toast.success(res.success || 'Removidos.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  /** Botões de ação de uma linha (tabela e cartão). No cartão (compacto),
   *  "Editar" vira só ícone e "Proposta" estica, para caber numa linha. */
  function atualizarLead(p: Prospeccao) {
    setItens((prev) => prev.map((x) => (x.id === p.id ? p : x)))
    setVisitasDe((atual) => (atual?.id === p.id ? p : atual))
  }

  function acoes(p: Prospeccao, compacto = false) {
    const wpp = primeiroWhatsapp(p)
    return (
      <>
        {/* No cartão o botão de visita fica junto do resumo da visita. */}
        {!compacto && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setVisitasDe(p)}
            leftIcon={<IconClipboardCheck size={12} />}
            title="Registrar o resultado da visita e ver o histórico"
            aria-label={`Visitas de ${p.nomeExecutado}`}
          >
            Visita
          </Button>
        )}
        {wpp && (
          <a
            href={linkWhatsapp(wpp, p.nomeExecutado)}
            target="_blank"
            rel="noopener noreferrer"
            title="Conversar no WhatsApp"
            aria-label={`WhatsApp de ${p.nomeExecutado}`}
            className="inline-flex min-h-8 items-center justify-center rounded-lg bg-emerald-500 px-2.5 text-white transition-colors hover:bg-emerald-600"
          >
            <IconBrandWhatsapp size={15} />
          </a>
        )}
        {emailValido(p.email) && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => abrirEmail(p)}
            title={
              p.ultimoEmailEm
                ? `Último e-mail em ${formatDate(p.ultimoEmailEm)}`
                : 'Enviar e-mail com oferta pelo veículo'
            }
            aria-label={`Enviar e-mail para ${p.nomeExecutado}`}
            className={
              p.ultimoEmailEm
                ? '!border-sky-300 !text-sky-700 adobe-dark:!border-sky-400/50 adobe-dark:!text-sky-300'
                : undefined
            }
          >
            <IconMail size={13} />
          </Button>
        )}
        {podeGerarProposta && (
          <Button
            size="sm"
            variant="liberty"
            onClick={() => gerarProposta(p)}
            leftIcon={<IconFileText size={12} />}
            title="Gerar proposta (PDF) com os dados desta linha"
            className={compacto ? 'flex-1' : undefined}
          >
            Proposta
          </Button>
        )}
        {compacto ? (
          <Button size="sm" variant="secondary" onClick={() => abrirEdicao(p)} aria-label="Editar">
            <IconPencil size={13} />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => abrirEdicao(p)}
            aria-label="Editar"
            leftIcon={<IconPencil size={12} />}
          >
            Editar
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setConfirmDelete(p)}
          aria-label="Remover"
          className="!border-rose-200 !text-rose-600 hover:!bg-rose-50"
        >
          <IconTrash size={12} />
        </Button>
      </>
    )
  }

  const buscados = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    if (!term) return itens
    const termDigits = term.replace(/\D/g, '')
    return itens.filter((p) => {
      const texto = [p.nomeExecutado, p.numeroProcesso, p.comarca, p.banco, p.veiculo, p.email]
        .join(' ')
        .toLowerCase()
      if (texto.includes(term)) return true
      // Placa sem hífen/espaço: "abc1234" acha "ABC-1234".
      const termPlaca = term.replace(/[^a-z0-9]/g, '')
      if (termPlaca.length >= 3 && p.placa.toLowerCase().replace(/[^a-z0-9]/g, '').includes(termPlaca)) {
        return true
      }
      return termDigits.length >= 3 && p.cpfCnpj.replace(/\D/g, '').includes(termDigits)
    })
  }, [itens, debouncedSearch])

  const filtrados = useMemo(
    () => ordenar(aplicarFiltros(buscados, filtros), ordem),
    [buscados, filtros, ordem],
  )
  const qtdFiltros = totalFiltrosAtivos(filtros) + (ordem ? 1 : 0)

  function aplicarFiltro(key: ColunaFiltro, sel: Set<string> | null) {
    setFiltros((prev) => {
      const next = { ...prev }
      if (sel) next[key] = sel
      else delete next[key]
      return next
    })
    setPage(1)
  }

  function ordenarPor(key: ColunaFiltro, dir: 'asc' | 'desc') {
    setOrdem({ key, dir })
    setPage(1)
  }

  function limparFiltros() {
    setFiltros({})
    setOrdem(null)
    setPage(1)
  }

  /** Menu de filtro da coluna (valores consideram busca + filtros das outras colunas). */
  function filtroDe(key: ColunaFiltro, fechar: () => void) {
    return (
      <FiltroLista
        valores={valoresDistintos(aplicarFiltros(buscados, filtros, key), key)}
        selecionados={filtros[key]}
        numerica={colunaNumerica(key)}
        ordem={ordem?.key === key ? ordem.dir : null}
        onAplicar={(sel) => aplicarFiltro(key, sel)}
        onOrdenar={(dir) => ordenarPor(key, dir)}
        onFechar={fechar}
      />
    )
  }

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visiveis = filtrados.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const paginaToda = visiveis.length > 0 && visiveis.every((p) => selecionados.has(p.id))
  const filtradosTodos = filtrados.length > 0 && filtrados.every((p) => selecionados.has(p.id))

  function alternarPagina() {
    setSelecionados((prev) => {
      const next = new Set(prev)
      for (const p of visiveis) {
        if (paginaToda) next.delete(p.id)
        else next.add(p.id)
      }
      return next
    })
  }

  const conteudo = (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-neutral-950">
            <IconUserSearch size={20} className="text-liberty-deep" />
            {titulo}
            <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-liberty/15 px-2 text-xs font-bold text-liberty-deep">
              {itens.length}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Executados em processos, com dados do financiamento e contato.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {itens.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => setConfirmLote('tudo')}
              disabled={submitting}
              leftIcon={<IconTrash size={16} stroke={2.2} />}
              className="order-3 !border-rose-200 !text-rose-600 hover:!bg-rose-50 sm:order-none"
            >
              Excluir tudo
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => setImportOpen(true)}
            leftIcon={<IconTableImport size={16} stroke={2.2} />}
            className="order-2 sm:order-none"
          >
            Colar da planilha
          </Button>
          <Button
            variant="liberty"
            onClick={abrirNovo}
            leftIcon={<IconPlus size={16} stroke={2.5} />}
            className="order-1 col-span-2 sm:order-none"
          >
            Nova prospecção
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar por nome, CPF, placa, processo, banco..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          containerClassName="w-full sm:w-96"
        />
        <Button
          variant="secondary"
          onClick={() => setTelaCheia((v) => !v)}
          leftIcon={
            telaCheia ? <IconArrowsMinimize size={16} stroke={2.2} /> : <IconArrowsMaximize size={16} stroke={2.2} />
          }
          title={telaCheia ? 'Sair da tela cheia (Esc)' : 'Ver a lista em tela cheia'}
          className="shrink-0"
        >
          <span className="hidden sm:inline">{telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}</span>
        </Button>
        <Button
          variant="secondary"
          onClick={() => setFiltrosMobileOpen(true)}
          leftIcon={<IconFilter size={16} stroke={2.2} />}
          title="Filtrar por coluna"
          className={`shrink-0 md:hidden ${qtdFiltros > 0 ? '!border-liberty-deep/40 !text-liberty-deep' : ''}`}
        >
          {qtdFiltros > 0 ? qtdFiltros : null}
        </Button>
        {qtdFiltros > 0 && (
          <Button
            variant="secondary"
            onClick={limparFiltros}
            leftIcon={<IconFilterOff size={16} stroke={2.2} />}
            title="Remover todos os filtros e a classificação"
            className="shrink-0"
          >
            <span className="hidden sm:inline">Limpar filtros ({qtdFiltros})</span>
          </Button>
        )}
      </div>

      {totalFiltrosAtivos(filtros) > 0 && (
        <p className="text-xs text-neutral-500">
          Mostrando <strong className="text-neutral-800">{filtrados.length}</strong> de {buscados.length}{' '}
          registros com filtro.
        </p>
      )}

      {selecionados.size > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-2.5 text-xs">
          <span className="font-bold text-neutral-900">
            {selecionados.size} selecionado{selecionados.size === 1 ? '' : 's'}
          </span>
          {!filtradosTodos && (
            <button
              type="button"
              onClick={() => setSelecionados(new Set(filtrados.map((p) => p.id)))}
              className="font-semibold text-liberty-deep hover:underline cursor-pointer"
            >
              Selecionar todos os {filtrados.length}
              {debouncedSearch.trim() ? ' da busca' : totalFiltrosAtivos(filtros) > 0 ? ' do filtro' : ''}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelecionados(new Set())}
            className="font-semibold text-neutral-500 hover:text-neutral-800 cursor-pointer"
          >
            Limpar seleção
          </button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setConfirmLote('selecionados')}
            disabled={submitting}
            leftIcon={<IconTrash size={12} />}
            className="ml-auto !border-rose-300 !text-rose-600 hover:!bg-rose-100 adobe-dark:!border-rose-500/40 adobe-dark:!text-rose-300 adobe-dark:hover:!bg-rose-500/20"
          >
            Excluir selecionados
          </Button>
        </div>
      )}

      {visiveis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-500">
          {itens.length === 0
            ? 'Nenhuma prospecção cadastrada. Cadastre uma ou cole as linhas da planilha.'
            : 'Nenhum registro encontrado para essa busca ou filtro.'}
          {itens.length > 0 && totalFiltrosAtivos(filtros) > 0 && (
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={limparFiltros} leftIcon={<IconFilterOff size={14} />}>
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
        {/* Altura limitada à tela: a barra de rolagem horizontal fica sempre
            visível no rodapé da caixa e o cabeçalho das colunas fica fixo. */}
        <div
          className={`hidden overflow-auto rounded-xl border border-neutral-200 bg-white shadow-xs md:block ${
            telaCheia ? 'max-h-[calc(100dvh-14rem)]' : 'max-h-[calc(100dvh-8rem)]'
          }`}
        >
          <table className="w-full border-collapse text-left text-xs text-neutral-600 adobe-dark:text-adobe-text-md">
            <THead>
              <tr>
                <TH className="sticky top-0 z-10 w-8 bg-neutral-50 !px-3">
                  <input
                    type="checkbox"
                    checked={paginaToda}
                    onChange={alternarPagina}
                    aria-label="Selecionar todos desta página"
                    className="h-4 w-4 cursor-pointer accent-liberty-deep"
                  />
                </TH>
                {COLUNAS_TABELA.map(({ key, label }) => (
                  <TH key={key} className="sticky top-0 z-10 whitespace-nowrap bg-neutral-50 !px-3 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      {label}
                      <FiltroColunaBotao
                        label={label}
                        filtrada={!!filtros[key]}
                        ordem={ordem?.key === key ? ordem.dir : null}
                      >
                        {(fechar) => filtroDe(key, fechar)}
                      </FiltroColunaBotao>
                    </div>
                  </TH>
                ))}
                <TH align="right" className="sticky right-0 top-0 z-20 bg-neutral-50 !px-3 text-[10px]">
                  Ações
                </TH>
              </tr>
            </THead>
            <TBody>
              {visiveis.map((p) => (
                <TR key={p.id} className={selecionados.has(p.id) ? 'bg-rose-50/50' : undefined}>
                  <TD className="w-8 !px-3">
                    <input
                      type="checkbox"
                      checked={selecionados.has(p.id)}
                      onChange={() => alternar(p.id)}
                      aria-label={`Selecionar ${p.nomeExecutado}`}
                      className="h-4 w-4 cursor-pointer accent-liberty-deep"
                    />
                  </TD>
                  {COLUNAS_TABELA.map(({ key }) => {
                    if (key === 'ultimaVisita') {
                      return (
                        <TD key={key} className="!px-3">
                          <button
                            type="button"
                            onClick={() => setVisitasDe(p)}
                            title="Registrar visita / ver histórico"
                            className="cursor-pointer text-left"
                          >
                            <UltimaVisita p={p} />
                          </button>
                        </TD>
                      )
                    }
                    if (key === 'retornoEm') {
                      const r = p.visitas[0]?.retornoEm
                      return (
                        <TD key={key} className={`whitespace-nowrap !px-3 ${r ? '' : 'text-neutral-400'}`}>
                          {r ? <DataRetorno data={r} /> : '—'}
                        </TD>
                      )
                    }
                    const vazio = p[key] === null || p[key] === ''
                    return (
                      <TD
                        key={key}
                        className={`!px-3 ${key === 'endereco' ? 'min-w-[280px]' : 'whitespace-nowrap'} ${
                          key === 'nomeExecutado' ? 'font-semibold text-neutral-900' : ''
                        } ${vazio ? 'text-neutral-400' : ''}`}
                      >
                        {PHONES.includes(key) && p[key] ? (
                          <Telefone valor={String(p[key])} nome={p.nomeExecutado} />
                        ) : key === 'endereco' && p.endereco ? (
                          <div>
                            <div>{p.endereco}</div>
                            <LinksMapa endereco={p.endereco} />
                          </div>
                        ) : (
                          celula(p, key)
                        )}
                      </TD>
                    )
                  })}
                  <TD align="right" className="sticky right-0 bg-white !px-3">
                    <div className="inline-flex gap-1.5">{acoes(p)}</div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </table>
        </div>

        {/* Celular: um cartão por registro (19 colunas não cabem numa tabela). */}
        <div className="space-y-3 md:hidden">
          <label className="flex items-center gap-2 px-1 text-xs font-semibold text-neutral-600">
            <input
              type="checkbox"
              checked={paginaToda}
              onChange={alternarPagina}
              className="h-4 w-4 cursor-pointer accent-liberty-deep"
            />
            Selecionar todos desta página
          </label>
          {visiveis.map((p) => (
            <CartaoProspeccao
              key={p.id}
              p={p}
              selecionado={selecionados.has(p.id)}
              onSelecionar={() => alternar(p.id)}
              onVisita={() => setVisitasDe(p)}
              acoes={acoes(p, true)}
            />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-xs sm:flex-row">
            <span className="text-xs text-neutral-500">
              Página {safePage} de {totalPages} · {filtrados.length} registros
            </span>
            <div className="inline-flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage((x) => Math.max(1, x - 1))}
                disabled={safePage === 1}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage((x) => Math.min(totalPages, x + 1))}
                disabled={safePage === totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
        </>
      )}

      <VisitasModal
        lead={visitasDe}
        onClose={() => setVisitasDe(null)}
        onAtualizado={atualizarLead}
        usuarioUid={usuarioUid}
        podeExcluirTodas={podeExcluirVisitas}
      />

      <Modal
        open={filtrosMobileOpen}
        onClose={() => setFiltrosMobileOpen(false)}
        title="Filtrar por coluna"
        size="sm"
      >
        <div className="space-y-3 pt-2">
          <Select
            label="Coluna"
            options={COLUNAS_TABELA.map(({ key, label }) => ({
              value: key,
              label: `${label}${filtros[key] ? ' (filtrada)' : ''}`,
            }))}
            value={colunaMobile}
            onChange={(e) => setColunaMobile(e.target.value as ColunaFiltro)}
          />
          {filtrosMobileOpen && (
            <FiltroLista
              key={colunaMobile}
              valores={valoresDistintos(aplicarFiltros(buscados, filtros, colunaMobile), colunaMobile)}
              selecionados={filtros[colunaMobile]}
              numerica={colunaNumerica(colunaMobile)}
              ordem={ordem?.key === colunaMobile ? ordem.dir : null}
              onAplicar={(sel) => aplicarFiltro(colunaMobile, sel)}
              onOrdenar={(dir) => ordenarPor(colunaMobile, dir)}
              onFechar={() => setFiltrosMobileOpen(false)}
              focarPesquisa={false}
            />
          )}
        </div>
      </Modal>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar prospecção' : 'Nova prospecção'}
        size="lg"
        className="max-h-[90vh] overflow-y-auto"
      >
        <form onSubmit={handleSubmit} className="grid gap-3 pt-2 sm:grid-cols-2">
          {PROSPECCAO_COLUNAS.map(({ key, label }) => (
            <Input
              key={key}
              label={key === 'nomeExecutado' ? `${label} *` : label}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: mascarar(key, e.target.value) }))}
              placeholder={PLACEHOLDERS[key]}
              inputMode={MONEY.includes(key) || INTS.includes(key) ? 'numeric' : undefined}
              type={key === 'email' ? 'email' : 'text'}
              autoComplete="off"
              containerClassName={
                key === 'endereco' || key === 'veiculo' || key === 'nomeExecutado'
                  ? 'sm:col-span-2'
                  : undefined
              }
            />
          ))}
          <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="liberty" disabled={submitting}>
              {submitting ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Colar da planilha"
        description="Copie as linhas na planilha e cole abaixo. Copie junto a linha do cabeçalho: assim as colunas são reconhecidas pelo nome, mesmo fora de ordem."
        size="lg"
        className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"
      >
        <div className="space-y-3 pt-2">
          <Textarea
            value={importTexto}
            onChange={(e) => setImportTexto(e.target.value)}
            rows={6}
            placeholder="Cole aqui (Ctrl+V) as linhas copiadas da planilha"
            className="font-mono text-xs"
          />
          <p className="text-xs text-neutral-500">
            {!importTexto.trim()
              ? 'Aguardando conteúdo colado.'
              : previa.length === 0
                ? 'Nenhuma linha reconhecida. Copie as células direto da planilha (colunas separadas por TAB).'
                : `${previa.length} registro(s) reconhecido(s) · colunas ${
                    leitura.porCabecalho
                      ? 'identificadas pelo cabeçalho'
                      : 'pela posição (sem cabeçalho: precisam estar na mesma ordem da tabela)'
                  }${leitura.ignoradas > 0 ? ` · ${leitura.ignoradas} linha(s) sem nome ignorada(s)` : ''}. Confira a prévia:`}
          </p>
          {previa.length > 0 && (
            <div className="max-h-72 overflow-auto rounded-lg border border-neutral-200">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead className="sticky top-0 bg-neutral-50">
                  <tr>
                    {PROSPECCAO_COLUNAS.map(({ key, label }) => (
                      <th
                        key={key}
                        className="whitespace-nowrap border-b border-neutral-200 px-2 py-1.5 font-semibold text-neutral-700"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {previa.slice(0, 20).map((p, i) => (
                    <tr key={i}>
                      {PROSPECCAO_COLUNAS.map(({ key }) => {
                        const vazio = p[key] === null || p[key] === ''
                        return (
                          <td
                            key={key}
                            className={`px-2 py-1 ${key === 'endereco' ? 'min-w-[220px]' : 'whitespace-nowrap'} ${
                              vazio ? 'text-neutral-300' : 'text-neutral-800'
                            }`}
                          >
                            {celula(p, key)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previa.length > 20 && (
                <p className="border-t border-neutral-200 px-2 py-1.5 text-[11px] text-neutral-500">
                  + {previa.length - 20} registro(s) não mostrados na prévia.
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="liberty"
              onClick={handleImport}
              disabled={submitting || previa.length === 0}
            >
              {submitting ? 'Importando...' : `Importar ${previa.length || ''}`.trim()}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!emailDe}
        onClose={() => !submitting && setEmailDe(null)}
        title="Oferta por e-mail"
        description={emailDe ? `Para: ${emailDe.email} · com cópia para a equipe` : undefined}
        size="lg"
        className="max-h-[90vh] overflow-y-auto"
      >
        {emailDe && (
          <form onSubmit={handleEnviarEmail} className="space-y-3 pt-2">
            {emailDe.ultimoEmailEm && (
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                Já foi enviado um e-mail em {formatDate(emailDe.ultimoEmailEm)}
                {emailDe.ultimoEmailValor != null
                  ? ` com oferta de ${formatCurrency(emailDe.ultimoEmailValor)}`
                  : ''}
                .
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <Input
                label="Valor da oferta *"
                value={ofertaValor}
                onChange={(e) => mudarValorOferta(e.target.value)}
                placeholder="0,00"
                inputMode="numeric"
                autoComplete="off"
                leftIcon={<span className="text-xs font-semibold">R$</span>}
              />
              <Input
                label="Assunto"
                value={ofertaAssunto}
                onChange={(e) => setOfertaAssunto(e.target.value)}
                maxLength={200}
              />
            </div>
            <Textarea
              label="Mensagem"
              value={ofertaMensagem}
              onChange={(e) => {
                setOfertaMensagem(e.target.value)
                setMensagemEditada(true)
              }}
              rows={11}
              maxLength={5000}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
              <span>
                O e-mail sai com a marca Liberty Car, um quadro com veículo e valor ofertado e um
                botão de WhatsApp. Respostas vão para a equipe.
              </span>
              {mensagemEditada && (
                <button
                  type="button"
                  onClick={() => {
                    setOfertaMensagem(mensagemPadrao(emailDe, ofertaValor))
                    setMensagemEditada(false)
                  }}
                  className="font-semibold text-liberty-deep hover:underline cursor-pointer"
                >
                  Restaurar texto padrão
                </button>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEmailDe(null)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="liberty"
                disabled={submitting}
                leftIcon={<IconMail size={14} />}
              >
                {submitting ? 'Enviando...' : 'Enviar e-mail'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!propostaDe}
        onClose={() => setPropostaDe(null)}
        title="Complete antes de gerar a proposta"
        description={
          propostaDe
            ? `Faltam dados obrigatórios da proposta de ${propostaDe.nomeExecutado}. O que você preencher fica salvo nesta prospecção.`
            : undefined
        }
      >
        <form onSubmit={handleCompletarProposta} className="space-y-3 pt-2">
          {pendentes.map(({ campo, motivo }) => (
            <Input
              key={campo}
              label={CAMPO_PENDENTE_LABEL[campo]}
              value={propostaForm[campo]}
              onChange={(e) => {
                const v = e.target.value
                setPropostaForm((f) => ({
                  ...f,
                  [campo]:
                    campo === 'cpfCnpj' ? maskCPFCNPJ(v) : campo === 'telefone1' ? maskPhone(v) : v,
                }))
              }}
              error={motivo}
              placeholder={PLACEHOLDERS[campo]}
              type={campo === 'email' ? 'email' : 'text'}
              inputMode={campo === 'cpfCnpj' || campo === 'telefone1' ? 'numeric' : undefined}
              autoComplete="off"
            />
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setPropostaDe(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="liberty" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar e abrir proposta'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Remover prospecção?"
        description={
          confirmDelete ? (
            <>
              Remover o registro de <strong>{confirmDelete.nomeExecutado}</strong>? Esta ação não
              pode ser desfeita.
            </>
          ) : null
        }
        confirmLabel="Remover"
        tone="danger"
      />

      <ConfirmDialog
        open={!!confirmLote}
        onClose={() => setConfirmLote(null)}
        onConfirm={handleDeleteLote}
        title={confirmLote === 'tudo' ? 'Excluir todas as prospecções?' : 'Excluir selecionados?'}
        description={
          <>
            Serão removidos{' '}
            <strong>
              {confirmLote === 'tudo' ? itens.length : selecionados.size} registro(s)
            </strong>
            {confirmLote === 'tudo' ? ' (a tabela inteira)' : ''}. Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        tone="danger"
      />
    </section>
  )

  if (!telaCheia) return conteudo
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-auto bg-neutral-50 p-4 sm:p-6">{conteudo}</div>,
    document.body,
  )
}
