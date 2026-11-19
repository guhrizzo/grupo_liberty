'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDate } from '@/utils/format'
import MarcaAsaas from '@/app/components/MarcaAsaas'
import MarcaSerasa from '@/app/components/MarcaSerasa'
import NegativacaoBox from '@/app/dashboard/cobrancas/NegativacaoBox'
import type { LinhaNegativacao, ClienteAtrasado } from '@/app/dashboard/cobrancas/negativacao-actions'
import { gerarCobrancaConsolidadaAsaas, salvarDadosClienteCobranca } from '@/app/dashboard/cobrancas/asaas-actions'

const ATIVAS = ['PENDING', 'AWAITING_APPROVAL', 'AWAITING_CANCELLATION', 'PROCESSED', 'PARTIALLY_PAID']

type Retorno = { success?: string; error?: string }

function Lista({
  titulo,
  vazio,
  linhas,
  podeNegativar,
  onMudou,
}: {
  titulo: string
  vazio: string
  linhas: LinhaNegativacao[]
  podeNegativar: boolean
  onMudou: (r: Retorno) => void
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-neutral-900">
        {titulo} <span className="font-normal text-neutral-500">({linhas.length})</span>
      </h2>
      {linhas.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">{vazio}</p>
      ) : (
        <ul className="space-y-3">
          {linhas.map((l) => (
            <li key={l.paymentId} className="rounded-xl border border-neutral-200 bg-white p-4 text-[11px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-neutral-900">{l.clienteNome}</p>
                  <p className="text-neutral-500">{l.veiculoResumo}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-neutral-900">{formatCurrency(l.valor)}</p>
                  <p className="text-neutral-500">
                    {l.billingType} · venceu em {formatDate(l.vencimento)}
                  </p>
                </div>
              </div>
              <NegativacaoBox
                paymentId={l.paymentId}
                vencida={l.statusCobranca === 'vencida'}
                negativacao={l.negativacao}
                podeNegativar={podeNegativar}
                onMudou={onMudou}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const botao =
  'rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-bold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer disabled:opacity-50'
const campoModal = 'mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs'

const ROTULO_CAMPO: Record<string, string> = { cpf: 'CPF', telefone: 'telefone', endereco: 'endereço' }

function ModalDadosCliente({
  cliente,
  onFechar,
  onSalvo,
}: {
  cliente: ClienteAtrasado
  onFechar: () => void
  onSalvo: (r: Retorno) => void
}) {
  const [dados, setDados] = useState(cliente.dados)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setErro(null)
    const r = await salvarDadosClienteCobranca(cliente.cobrancaId, dados)
    setOcupado(false)
    if ('error' in r) return setErro(r.error)
    onSalvo({ success: r.success })
    onFechar()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onFechar}>
      <form
        onSubmit={salvar}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-xl border border-neutral-200 bg-white p-5"
      >
        <div>
          <h3 className="text-sm font-bold text-neutral-900">Dados de {cliente.clienteNome}</h3>
          <p className="text-[11px] text-neutral-500">
            Faltando: {cliente.faltando.map((c) => ROTULO_CAMPO[c]).join(', ')}. O Asaas exige esses dados para
            cobrar e negativar.
          </p>
        </div>
        <label className="block text-[11px] text-neutral-600">
          CPF
          <input
            className={campoModal}
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={dados.cpf}
            onChange={(e) => setDados({ ...dados, cpf: e.target.value })}
            autoFocus={cliente.faltando.includes('cpf')}
          />
        </label>
        <label className="block text-[11px] text-neutral-600">
          Telefone (com DDD)
          <input
            className={campoModal}
            inputMode="tel"
            placeholder="(11) 91234-5678"
            value={dados.telefone}
            onChange={(e) => setDados({ ...dados, telefone: e.target.value })}
          />
        </label>
        <label className="block text-[11px] text-neutral-600">
          Endereço completo (rua, número, bairro, CEP)
          <textarea
            className={campoModal}
            rows={2}
            placeholder="Rua das Flores, 123, Centro, São Paulo - SP, 01001-000"
            value={dados.endereco}
            onChange={(e) => setDados({ ...dados, endereco: e.target.value })}
          />
        </label>
        {erro && <p className="text-[11px] font-semibold text-rose-700 adobe-dark:text-rose-300">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={botao} onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className={botao} disabled={ocupado}>
            {ocupado ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}

/** Minúsculas e sem acento, para a pesquisa não depender de maiúsculas/acentos. */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function ClientesAtrasados({
  clientes,
  onMudou,
  filtrando,
}: {
  clientes: ClienteAtrasado[]
  onMudou: (r: Retorno) => void
  filtrando: boolean
}) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [modal, setModal] = useState<ClienteAtrasado | null>(null)
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const totalGeral = clientes.reduce((s, c) => s + c.totalDevido, 0)
  const todosAbertos = clientes.length > 0 && clientes.every((c) => abertos.has(c.cobrancaId))

  function alternar(id: string) {
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (!novo.delete(id)) novo.add(id)
      return novo
    })
  }

  // Parcelas desmarcadas pelo usuário; por padrão todas as ainda não cobradas vêm marcadas.
  const [desmarcadas, setDesmarcadas] = useState<Set<string>>(new Set())

  function selecionadas(c: ClienteAtrasado) {
    return c.parcelas.filter((p) => !p.cobrada && !desmarcadas.has(p.parcelaId))
  }

  function marcar(ids: string[], marcada: boolean) {
    setDesmarcadas((atual) => {
      const novo = new Set(atual)
      for (const id of ids) {
        if (marcada) novo.delete(id)
        else novo.add(id)
      }
      return novo
    })
  }

  async function gerar(c: ClienteAtrasado, tipo: 'PIX' | 'BOLETO') {
    if (c.faltando.length > 0) return setModal(c)
    const escolhidas = selecionadas(c)
    if (escolhidas.length === 0) return onMudou({ error: 'Selecione ao menos uma parcela.' })
    setOcupado(c.cobrancaId + tipo)
    const r = await gerarCobrancaConsolidadaAsaas(
      c.cobrancaId,
      tipo,
      escolhidas.map((p) => p.parcelaId),
    )
    setOcupado(null)
    onMudou('error' in r ? { error: r.error } : { success: r.success })
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-neutral-900">
        Clientes em atraso, sem cobrança vencida no Asaas{' '}
        <span className="font-normal text-neutral-500">
          ({clientes.length}) · total {formatCurrency(totalGeral)}
        </span>
      </h2>
      <p className="text-[11px] text-neutral-500">
        O Asaas só negativa cobranças dele. Escolha as parcelas (todas vêm marcadas) e gere uma cobrança única
        com a soma delas, com multa e juros até hoje e vencimento hoje. Depois que vencer, ela aparece em
        &ldquo;Cobranças vencidas, sem negativação&rdquo;.
      </p>
      {clientes.length > 1 && (
        <button
          type="button"
          className={botao}
          onClick={() =>
            setAbertos(todosAbertos ? new Set() : new Set(clientes.map((c) => c.cobrancaId)))
          }
        >
          {todosAbertos ? 'Encolher todos' : 'Expandir todos'}
        </button>
      )}
      {clientes.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          {filtrando ? 'Nenhum cliente encontrado na pesquisa.' : 'Nenhum cliente em atraso pendente de cobrança.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {clientes.map((c) => (
            <li key={c.cobrancaId} className="rounded-xl border border-neutral-200 bg-white p-4 text-[11px]">
              <button
                type="button"
                onClick={() => alternar(c.cobrancaId)}
                aria-expanded={abertos.has(c.cobrancaId)}
                className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${
                      abertos.has(c.cobrancaId) ? 'rotate-90' : ''
                    }`}
                  >
                    <path d="M7.2 4.5a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 1 1-1.4-1.4L11.5 10 7.2 5.9a1 1 0 0 1 0-1.4Z" />
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-neutral-900">{c.clienteNome}</p>
                    <p className="text-neutral-500">{c.veiculoResumo}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-neutral-900">
                    {formatCurrency(selecionadas(c).reduce((s, p) => s + p.totalDevido, 0))}
                  </p>
                  <p className="text-neutral-500">
                    {selecionadas(c).length} de {c.parcelas.filter((p) => !p.cobrada).length} selecionadas · desde{' '}
                    {formatDate(c.parcelas[0].vencimento)}
                  </p>
                </div>
              </button>
              {abertos.has(c.cobrancaId) && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-3 text-[11px] font-bold text-blue-600">
                    <button
                      type="button"
                      className="cursor-pointer underline"
                      onClick={() =>
                        marcar(
                          c.parcelas.filter((p) => !p.cobrada).map((p) => p.parcelaId),
                          true,
                        )
                      }
                    >
                      Marcar todas
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer underline"
                      onClick={() =>
                        marcar(
                          c.parcelas.filter((p) => !p.cobrada).map((p) => p.parcelaId),
                          false,
                        )
                      }
                    >
                      Desmarcar todas
                    </button>
                  </div>
                  <ul className="space-y-0.5 text-neutral-500">
                    {c.parcelas.map((p) => (
                      <li key={p.parcelaId} className="flex items-center justify-between gap-2">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={p.cobrada !== null}
                            checked={p.cobrada === null && !desmarcadas.has(p.parcelaId)}
                            onChange={(e) => marcar([p.parcelaId], e.target.checked)}
                          />
                          <span>
                            Parcela {p.numeroParcela}/{c.numeroParcelas} · venceu em {formatDate(p.vencimento)} (
                            {p.diasAtraso} dias)
                            {p.cobrada && (
                              <span className="ml-1 font-semibold text-amber-700 adobe-dark:text-amber-300">
                                · {p.cobrada.billingType} gerado, vence em {formatDate(p.cobrada.vencimento)}
                                {p.cobrada.link && (
                                  <>
                                    {' '}
                                    <a
                                      href={p.cobrada.link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-600 underline"
                                    >
                                      Abrir link
                                    </a>
                                  </>
                                )}
                              </span>
                            )}
                          </span>
                        </label>
                        <span>{formatCurrency(p.totalDevido)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {c.parcelas.every((p) => p.cobrada) ? (
                  <span className="font-semibold text-amber-700 adobe-dark:text-amber-300">
                    Todas as parcelas já têm cobrança gerada. Aguardando vencer para negativar.
                  </span>
                ) : (
                  <>
                    {!abertos.has(c.cobrancaId) && (
                      <span className="text-neutral-500">Expanda para escolher as parcelas.</span>
                    )}
                    {c.faltando.length > 0 && (
                      <>
                        <span className="font-semibold text-rose-700 adobe-dark:text-rose-300">
                          Faltando {c.faltando.map((f) => ROTULO_CAMPO[f]).join(', ')}.
                        </span>
                        <button type="button" className={botao} onClick={() => setModal(c)}>
                          Completar dados
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className={botao}
                      disabled={ocupado !== null || selecionadas(c).length === 0}
                      onClick={() => gerar(c, 'BOLETO')}
                    >
                      {ocupado === c.cobrancaId + 'BOLETO' ? 'Gerando…' : 'Gerar boleto'}
                    </button>
                    <button
                      type="button"
                      className={botao}
                      disabled={ocupado !== null || selecionadas(c).length === 0}
                      onClick={() => gerar(c, 'PIX')}
                    >
                      {ocupado === c.cobrancaId + 'PIX' ? 'Gerando…' : 'Gerar Pix'}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {modal && <ModalDadosCliente cliente={modal} onFechar={() => setModal(null)} onSalvo={onMudou} />}
    </section>
  )
}

export default function NegativacoesClient({
  linhas,
  atrasadas,
  podeNegativar,
}: {
  linhas: LinhaNegativacao[]
  atrasadas: ClienteAtrasado[]
  podeNegativar: boolean
}) {
  const router = useRouter()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const [busca, setBusca] = useState('')
  const termo = normalizar(busca)
  const termoDigitos = busca.replace(/\D/g, '')
  const linhasFiltradas = termo
    ? linhas.filter((l) => normalizar(`${l.clienteNome} ${l.veiculoResumo} ${l.paymentId}`).includes(termo))
    : linhas
  const atrasadasFiltradas = termo
    ? atrasadas.filter(
        (c) =>
          normalizar(`${c.clienteNome} ${c.veiculoResumo}`).includes(termo) ||
          (termoDigitos.length >= 3 && c.dados.cpf.replace(/\D/g, '').includes(termoDigitos)),
      )
    : atrasadas

  const emAndamento = linhasFiltradas.filter((l) => l.negativacao && ATIVAS.includes(l.negativacao.status))
  const encerradas = linhasFiltradas.filter((l) => l.negativacao && !ATIVAS.includes(l.negativacao.status))
  const candidatas = linhasFiltradas.filter((l) => !l.negativacao && l.statusCobranca === 'vencida')

  function onMudou(r: Retorno) {
    setMsg(r.error ? { tipo: 'erro', texto: r.error } : r.success ? { tipo: 'ok', texto: r.success } : null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-neutral-950">Negativações</h1>
        <p className="text-sm text-neutral-500">
          Negativação no <MarcaSerasa /> de cobranças do <MarcaAsaas /> vencidas e não pagas.
          {!podeNegativar && ' Apenas administradores podem negativar ou cancelar.'}
        </p>
      </header>

      <div className="relative">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar por cliente, placa, veículo ou CPF"
          aria-label="Pesquisar negativações"
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
        />
      </div>

      {msg && (
        <p
          className={`text-sm font-semibold ${
            msg.tipo === 'erro'
              ? 'text-rose-700 adobe-dark:text-rose-300'
              : 'text-emerald-700 adobe-dark:text-emerald-300'
          }`}
        >
          {msg.texto}
        </p>
      )}

      <Lista
        titulo="Em andamento"
        vazio="Nenhuma negativação em andamento."
        linhas={emAndamento}
        podeNegativar={podeNegativar}
        onMudou={onMudou}
      />
      {candidatas.length > 0 && (
        <Lista
          titulo="Cobranças vencidas, sem negativação"
          vazio=""
          linhas={candidatas}
          podeNegativar={podeNegativar}
          onMudou={onMudou}
        />
      )}
      <ClientesAtrasados clientes={atrasadasFiltradas} onMudou={onMudou} filtrando={termo !== ''} />
      {encerradas.length > 0 && (
        <Lista
          titulo="Encerradas"
          vazio=""
          linhas={encerradas}
          podeNegativar={podeNegativar}
          onMudou={onMudou}
        />
      )}
    </div>
  )
}
