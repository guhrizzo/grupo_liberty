'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatCurrency, formatDate } from '@/utils/format'
import { maskMoney, parseMoney } from '@/utils/masks'
import {
  cancelarCobrancaAsaas,
  definirReservaVeiculo,
  gerarCobrancaAsaas,
  getPainelAsaas,
  sugerirReservaVeiculo,
  type PainelAsaas,
} from './asaas-actions'

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Aguardando pagamento',
  recebida: 'Recebida',
  vencida: 'Vencida (inadimplente)',
  cancelada: 'Cancelada',
  estornada: 'Estornada',
}

const STATUS_COR: Record<string, string> = {
  pendente: 'text-sky-700',
  recebida: 'text-emerald-700',
  vencida: 'text-rose-700',
  cancelada: 'text-neutral-500',
  estornada: 'text-amber-700',
}

/** Cobrança via Asaas (Pix/boleto com split de reserva) de uma parcela. */
export default function AsaasParcelaPanel({
  parcelaId,
  cobrancaId,
  veiculoId,
}: {
  parcelaId: string
  cobrancaId: string
  veiculoId: string
}) {
  const [painel, setPainel] = useState<PainelAsaas | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [editando, setEditando] = useState(false)
  const [pct, setPct] = useState('')
  const [saldoDevedor, setSaldoDevedor] = useState('')

  const carregar = useCallback(async () => {
    const r = await getPainelAsaas(parcelaId, veiculoId)
    if ('error' in r) {
      setErro(r.error)
      return
    }
    setErro(null)
    setPainel(r)
    setPct(String(r.reserva.pct).replace('.', ','))
    setSaldoDevedor(
      r.reserva.saldoDevedorBase ? maskMoney(String(Math.round(r.reserva.saldoDevedorBase * 100))) : '',
    )
  }, [parcelaId, veiculoId])

  useEffect(() => {
    let ativo = true
    getPainelAsaas(parcelaId, veiculoId).then((r) => {
      if (!ativo) return
      if ('error' in r) return setErro(r.error)
      setPainel(r)
      setPct(String(r.reserva.pct).replace('.', ','))
      setSaldoDevedor(
        r.reserva.saldoDevedorBase ? maskMoney(String(Math.round(r.reserva.saldoDevedorBase * 100))) : '',
      )
    })
    return () => {
      ativo = false
    }
  }, [parcelaId, veiculoId])

  async function executar(fn: () => Promise<{ success?: string; error?: string }>) {
    setOcupado(true)
    setErro(null)
    setAviso(null)
    try {
      const r = await fn()
      if (r.error) setErro(r.error)
      else setAviso(r.success ?? null)
      await carregar()
    } finally {
      setOcupado(false)
    }
  }

  async function sugerir() {
    setOcupado(true)
    setErro(null)
    try {
      const r = await sugerirReservaVeiculo(cobrancaId, parseMoney(saldoDevedor))
      if ('error' in r) setErro(r.error)
      else setPct(String(r.pct).replace('.', ','))
    } finally {
      setOcupado(false)
    }
  }

  if (!painel) {
    return (
      <p className="text-[11px] text-neutral-500">{erro ?? 'Carregando cobrança Asaas...'}</p>
    )
  }

  const botao =
    'rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-ui cursor-pointer disabled:opacity-50'

  return (
    <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3 adobe-dark:border-violet-400/30 adobe-dark:bg-violet-500/10">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-violet-900 adobe-dark:text-violet-300">Cobrar pelo Asaas</span>
        <span className="text-[11px] text-neutral-600">
          Reserva do veículo: <b>{painel.reserva.pct}%</b> · acumulado{' '}
          <b>{formatCurrency(painel.reserva.saldoAcumulado)}</b>
        </span>
      </div>

      {!painel.configurado && (
        <p className="text-[11px] font-semibold text-amber-700 adobe-dark:text-amber-300">
          Asaas não configurado neste ambiente (ASAAS_API_KEY / ASAAS_RESERVA_WALLET_ID).
        </p>
      )}
      {painel.configurado && painel.reserva.pct === 0 && (
        <p className="text-[11px] font-semibold text-amber-700 adobe-dark:text-amber-300">
          Este veículo está sem % de reserva: a cobrança sai sem split.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={ocupado || !painel.configurado}
          className={botao}
          onClick={() => executar(() => gerarCobrancaAsaas(parcelaId, 'PIX'))}
        >
          Gerar Pix
        </button>
        <button
          type="button"
          disabled={ocupado || !painel.configurado}
          className={botao}
          onClick={() => executar(() => gerarCobrancaAsaas(parcelaId, 'BOLETO'))}
        >
          Gerar boleto
        </button>
        <button
          type="button"
          disabled
          title="Aguardando validação do split no cartão com o Asaas"
          className={botao}
        >
          Cartão (indisponível)
        </button>
        {painel.podeEditarReserva && (
          <button type="button" className={botao} onClick={() => setEditando((v) => !v)}>
            {editando ? 'Fechar reserva' : 'Definir reserva'}
          </button>
        )}
      </div>

      {editando && painel.podeEditarReserva && (
        <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-neutral-600">
              Saldo devedor a quitar
              <input
                value={saldoDevedor}
                onChange={(e) => setSaldoDevedor(maskMoney(e.target.value))}
                inputMode="numeric"
                placeholder="R$ 0,00"
                className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs"
              />
            </label>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex-1 text-[11px] text-neutral-600">
              % da reserva (sobre o valor bruto da parcela)
              <input
                value={pct}
                onChange={(e) => setPct(e.target.value.replace(/[^\d,]/g, ''))}
                inputMode="decimal"
                className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs"
              />
            </label>
            <button type="button" disabled={ocupado} className={botao} onClick={sugerir}>
              Sugerir
            </button>
            <button
              type="button"
              disabled={ocupado}
              className={botao}
              onClick={() =>
                executar(() =>
                  definirReservaVeiculo(veiculoId, {
                    pct: Number(pct.replace(',', '.')) || 0,
                    saldoDevedorBase: parseMoney(saldoDevedor) || null,
                    parcelasRestantes: null,
                  }),
                )
              }
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {erro && <p className="text-[11px] font-semibold text-rose-700 adobe-dark:text-rose-300">{erro}</p>}
      {aviso && <p className="text-[11px] font-semibold text-emerald-700 adobe-dark:text-emerald-300">{aviso}</p>}

      {painel.cobrancas.length > 0 && (
        <ul className="space-y-1.5">
          {painel.cobrancas.map((c) => (
            <li key={c.paymentId} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-neutral-800">
                  {c.billingType} · {formatCurrency(c.valor)} · vence {formatDate(c.vencimento)}
                </span>
                <span className={`font-bold ${STATUS_COR[c.status] ?? ''}`}>
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-neutral-500">
                <span>
                  Split {c.reservaPct}%
                  {c.valorReserva != null && ` · reserva ${formatCurrency(c.valorReserva)}`}
                </span>
                <span className="flex gap-3">
                  {c.link && (
                    <a href={c.link} target="_blank" rel="noreferrer" className="font-bold text-violet-700 underline adobe-dark:text-violet-300">
                      Abrir link
                    </a>
                  )}
                  {(c.status === 'pendente' || c.status === 'vencida') && (
                    <button
                      type="button"
                      disabled={ocupado}
                      className="font-bold text-rose-600 underline adobe-dark:text-rose-400 cursor-pointer disabled:opacity-50"
                      onClick={() => executar(() => cancelarCobrancaAsaas(c.paymentId))}
                    >
                      Cancelar
                    </button>
                  )}
                </span>
              </div>
              {c.divergencia && (
                <p className="mt-1 font-semibold text-rose-700 adobe-dark:text-rose-300">
                  Divergência de split bloqueada no Asaas — resolver em até 2 dias úteis.
                </p>
              )}
              {c.revisaoManual && <p className="mt-1 font-semibold text-amber-700 adobe-dark:text-amber-300">{c.revisaoManual}</p>}
              {c.pendenciaBaixa && (
                <p className="mt-1 font-semibold text-amber-700 adobe-dark:text-amber-300">
                  Pagamento recebido mas baixa não aplicada: {c.pendenciaBaixa}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
