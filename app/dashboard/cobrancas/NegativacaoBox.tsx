'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/utils/format'
import MarcaSerasa from '@/app/components/MarcaSerasa'
import type { NegativacaoRegistro } from '@/utils/asaas/negativacao'
import {
  atualizarNegativacaoAsaas,
  cancelarNegativacaoAsaas,
  getPrefillNegativacao,
  negativarCobrancaAsaas,
  reenviarDocumentoNegativacaoAsaas,
  simularNegativacaoAsaas,
  type SimulacaoNegativacao,
} from './negativacao-actions'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  AWAITING_APPROVAL: 'Em análise',
  AWAITING_CANCELLATION: 'Cancelamento em andamento',
  PROCESSED: 'Negativado',
  PAID: 'Paga',
  PARTIALLY_PAID: 'Paga parcialmente',
  DENIED: 'Negada',
  CANCELLED: 'Cancelada',
}

const STATUS_COR: Record<string, string> = {
  PROCESSED: 'text-rose-700 adobe-dark:text-rose-300',
  PAID: 'text-emerald-700 adobe-dark:text-emerald-300',
  PARTIALLY_PAID: 'text-emerald-700 adobe-dark:text-emerald-300',
  DENIED: 'text-rose-700 adobe-dark:text-rose-300',
  CANCELLED: 'text-neutral-500',
}

const ATIVA = ['PENDING', 'AWAITING_APPROVAL', 'AWAITING_CANCELLATION', 'PROCESSED', 'PARTIALLY_PAID']

const campo =
  'mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs'
const rotulo = 'text-[11px] text-neutral-600'
const botao =
  'rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-bold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer disabled:opacity-50'

interface Props {
  paymentId: string
  vencida: boolean
  negativacao: NegativacaoRegistro | null
  podeNegativar: boolean
  onMudou: (r: { success?: string; error?: string }) => void
}

/** Negativação (Serasa) de uma cobrança vencida do Asaas. */
export default function NegativacaoBox({ paymentId, vencida, negativacao, podeNegativar, onMudou }: Props) {
  const [aberto, setAberto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [simulacao, setSimulacao] = useState<SimulacaoNegativacao | null>(null)
  const [prefill, setPrefill] = useState<{ endereco: string } | null>(null)
  const [dados, setDados] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    descricao: '',
  })

  const ativa = negativacao != null && ATIVA.includes(negativacao.status)
  const set = (k: keyof typeof dados, v: string) => setDados((d) => ({ ...d, [k]: v }))

  async function abrir() {
    setAberto(true)
    setErro(null)
    setOcupado(true)
    try {
      const [p, s] = await Promise.all([getPrefillNegativacao(paymentId), simularNegativacaoAsaas(paymentId)])
      if ('error' in p) return setErro(p.error)
      setPrefill({ endereco: p.enderecoTexto })
      setDados((d) => ({
        ...d,
        nome: p.nome,
        cpf: p.cpf,
        telefone: p.telefone,
        descricao: p.descricao,
      }))
      if ('error' in s) setErro(s.error)
      else setSimulacao(s.simulacao)
    } finally {
      setOcupado(false)
    }
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const arquivo = (e.currentTarget.elements.namedItem('documents') as HTMLInputElement | null)?.files?.[0]
    if (!arquivo) return setErro('Anexe o contrato ou a nota fiscal.')
    if (
      !window.confirm(
        'Negativar este cliente no Serasa? A solicitação gera custo e tem efeito jurídico. Confirma?',
      )
    ) {
      return
    }
    const form = new FormData()
    form.set('payment', paymentId)
    form.set('customerName', dados.nome)
    form.set('customerCpfCnpj', dados.cpf)
    form.set('customerPrimaryPhone', dados.telefone)
    form.set('customerPostalCode', dados.cep)
    form.set('customerAddress', dados.logradouro)
    form.set('customerAddressNumber', dados.numero)
    form.set('customerComplement', dados.complemento)
    form.set('customerProvince', dados.bairro)
    form.set('description', dados.descricao)
    form.set('documents', arquivo)
    setOcupado(true)
    setErro(null)
    try {
      const r = await negativarCobrancaAsaas(form)
      if ('error' in r) setErro(r.error)
      else {
        setAberto(false)
        onMudou(r)
      }
    } finally {
      setOcupado(false)
    }
  }

  async function reenviar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    const form = new FormData()
    form.set('payment', paymentId)
    form.set('documents', arquivo)
    setOcupado(true)
    try {
      onMudou(await reenviarDocumentoNegativacaoAsaas(form))
    } finally {
      setOcupado(false)
      e.target.value = ''
    }
  }

  async function executar(fn: () => Promise<{ success?: string; error?: string }>) {
    setOcupado(true)
    try {
      onMudou(await fn())
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mt-2 space-y-2 border-t border-neutral-200 pt-2">
      {negativacao && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-neutral-800">
              Negativação <MarcaSerasa />
            </span>
            <span className={`font-bold ${STATUS_COR[negativacao.status] ?? 'text-amber-700 adobe-dark:text-amber-300'}`}>
              {STATUS_LABEL[negativacao.status] ?? negativacao.status}
            </span>
          </div>
          <p className="text-neutral-500">
            Pedida em {formatDate(negativacao.solicitadaEm.slice(0, 10))}
            {negativacao.taxa != null && ` · custo ${formatCurrency(negativacao.taxa)}`}
            {negativacao.liquido != null && ` · líquido a recuperar ${formatCurrency(negativacao.liquido)}`}
          </p>
          {negativacao.motivoNegacao && (
            <p className="font-semibold text-rose-700 adobe-dark:text-rose-300">
              Motivo da negação: {negativacao.motivoNegacao}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={ocupado}
              className={botao}
              onClick={() => executar(() => atualizarNegativacaoAsaas(paymentId))}
            >
              Atualizar status
            </button>
            {podeNegativar && negativacao.podeCancelar && (
              <button
                type="button"
                disabled={ocupado}
                className={`${botao} text-rose-600`}
                onClick={() => {
                  if (window.confirm('Cancelar a negativação deste cliente?')) {
                    void executar(() => cancelarNegativacaoAsaas(paymentId))
                  }
                }}
              >
                Cancelar negativação
              </button>
            )}
            {podeNegativar && negativacao.precisaReenviarDocumento && (
              <label className={`${botao} cursor-pointer`}>
                Reenviar documento
                <input type="file" className="hidden" onChange={reenviar} disabled={ocupado} />
              </label>
            )}
          </div>
          {!negativacao.podeCancelar && negativacao.motivoNaoCancelar && ativa && (
            <p className="text-neutral-500">{negativacao.motivoNaoCancelar}</p>
          )}
        </div>
      )}

      {podeNegativar && vencida && !ativa && !aberto && (
        <button type="button" className={`${botao} text-rose-600`} onClick={abrir}>
          Negativar cliente
        </button>
      )}

      {aberto && (
        <form onSubmit={enviar} className="space-y-2 rounded-lg border border-rose-200 p-3 adobe-dark:border-rose-400/30">
          <p className="text-xs font-bold text-rose-700 adobe-dark:text-rose-300">
            Negativar no <MarcaSerasa />
          </p>
          {simulacao && (
            <p className={`text-[11px] font-semibold ${simulacao.permitido ? 'text-emerald-700 adobe-dark:text-emerald-300' : 'text-rose-700 adobe-dark:text-rose-300'}`}>
              {simulacao.permitido
                ? `Permitido pelo Asaas${simulacao.taxa != null ? ` · custo ${formatCurrency(simulacao.taxa)}` : ''}${simulacao.liquido != null ? ` · líquido ${formatCurrency(simulacao.liquido)}` : ''}.`
                : `Não permitido: ${simulacao.motivo ?? 'motivo não informado pelo Asaas.'}`}
            </p>
          )}
          {erro && <p className="text-[11px] font-semibold text-rose-700 adobe-dark:text-rose-300">{erro}</p>}

          {prefill?.endereco && (
            <p className="text-[11px] text-neutral-500">
              Endereço cadastrado: {prefill.endereco}. O Asaas exige os campos separados abaixo.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className={`${rotulo} col-span-2`}>
              Nome
              <input className={campo} value={dados.nome} onChange={(e) => set('nome', e.target.value)} required />
            </label>
            <label className={rotulo}>
              CPF/CNPJ
              <input className={campo} value={dados.cpf} onChange={(e) => set('cpf', e.target.value)} required />
            </label>
            <label className={rotulo}>
              Telefone (DDD)
              <input className={campo} value={dados.telefone} onChange={(e) => set('telefone', e.target.value)} required />
            </label>
            <label className={rotulo}>
              CEP
              <input className={campo} value={dados.cep} onChange={(e) => set('cep', e.target.value)} required />
            </label>
            <label className={rotulo}>
              Número
              <input className={campo} value={dados.numero} onChange={(e) => set('numero', e.target.value)} required />
            </label>
            <label className={`${rotulo} col-span-2`}>
              Logradouro
              <input className={campo} value={dados.logradouro} onChange={(e) => set('logradouro', e.target.value)} required />
            </label>
            <label className={rotulo}>
              Bairro
              <input className={campo} value={dados.bairro} onChange={(e) => set('bairro', e.target.value)} required />
            </label>
            <label className={rotulo}>
              Complemento
              <input className={campo} value={dados.complemento} onChange={(e) => set('complemento', e.target.value)} />
            </label>
            <label className={`${rotulo} col-span-2`}>
              Descrição do serviço
              <input className={campo} value={dados.descricao} onChange={(e) => set('descricao', e.target.value)} />
            </label>
            <label className={`${rotulo} col-span-2`}>
              Contrato ou nota fiscal (com firma reconhecida em cartório)
              <input name="documents" type="file" accept=".pdf,image/*" className={campo} required />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={ocupado || (simulacao != null && !simulacao.permitido)}
              className={`${botao} text-rose-600`}
            >
              {ocupado ? 'Enviando...' : 'Solicitar negativação'}
            </button>
            <button type="button" disabled={ocupado} className={botao} onClick={() => setAberto(false)}>
              Fechar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
