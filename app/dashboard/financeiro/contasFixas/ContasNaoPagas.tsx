'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react'
import { Button, Input, Modal, useToast } from '@/app/components/ui'
import { formatCurrency } from '@/utils/format'
import { maskMoneyIntuitivo, moneyFromNumber, parseMoneyIntuitivo } from '../money'
import { hojeNoFuso, rotuloMes } from '../periodo'
import { marcarContaFixaPaga } from './actions'
import type { ContaFixaFieldErrors, ContaFixaPendente } from './types'

/** Conta + competência a pagar — do mês em tela ou de uma pendência de outro mês. */
export type AlvoPagamento = Pick<ContaFixaPendente, 'conta' | 'mes' | 'vencimento'>

/** `2026-09-05` → `05/09/2026`. */
function dataBR(data: string): string {
  return data ? `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}` : '—'
}

/**
 * Modal "marcar como paga": lança a despesa na competência do alvo (não no mês
 * em tela). Usado pela lista do mês e pelo painel de não pagas.
 */
export function ModalPagamentoContaFixa({
  alvo,
  onClose,
}: {
  alvo: AlvoPagamento | null
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<ContaFixaFieldErrors>({})
  const [valorPago, setValorPago] = useState('')
  const [dataPagamento, setDataPagamento] = useState('')
  // Reinicia o form quando outro alvo é aberto (ajuste de estado no render).
  const [alvoAnterior, setAlvoAnterior] = useState<AlvoPagamento | null>(null)
  if (alvo !== alvoAnterior) {
    setAlvoAnterior(alvo)
    if (alvo) {
      setValorPago(moneyFromNumber(alvo.conta.valor))
      setDataPagamento(hojeNoFuso())
      setFieldErrors({})
    }
  }

  function fechar() {
    if (!submitting) onClose()
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!alvo) return
    const fd = new FormData()
    // Número já convertido: a máscara exibe "1.500", que o servidor leria como 1,5.
    fd.set('valor', String(parseMoneyIntuitivo(valorPago)))
    fd.set('data', dataPagamento)
    setSubmitting(true)
    try {
      const result = await marcarContaFixaPaga(alvo.conta.id, alvo.mes, fd)
      if (result.error) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.error)
        router.refresh()
        return
      }
      if (result.success) toast.success(result.success)
      router.refresh()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={!!alvo}
      onClose={fechar}
      title={alvo ? `Pagar ${alvo.conta.nome}` : ''}
      description={
        alvo
          ? `Referente a ${rotuloMes(alvo.mes)} · vence ${dataBR(alvo.vencimento)}. A despesa entra no Financeiro na data do pagamento.`
          : undefined
      }
    >
      <form onSubmit={confirmar} className="mt-4 space-y-5">
        <Input
          label="Valor pago (R$)"
          value={valorPago}
          onChange={(e) => setValorPago(maskMoneyIntuitivo(e.target.value))}
          inputMode="decimal"
          error={fieldErrors.valor}
          required
        />
        <Input
          label="Data do pagamento"
          type="date"
          value={dataPagamento}
          onChange={(e) => setDataPagamento(e.target.value)}
          error={fieldErrors.data}
          required
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={fechar} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="liberty" loading={submitting}>
            Confirmar pagamento
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Painel vermelho com as contas fixas vencidas e não pagas de qualquer mês.
 * Aparece nas duas abas do Financeiro até cada conta ser paga.
 */
export default function ContasNaoPagas({
  pendencias,
  navegando,
}: {
  pendencias: ContaFixaPendente[]
  navegando: boolean
}) {
  const [pagando, setPagando] = useState<AlvoPagamento | null>(null)

  if (pendencias.length === 0) return null
  const total = pendencias.reduce((soma, p) => soma + p.conta.valor, 0)

  return (
    <div className="rounded-2xl border border-rose-300 bg-rose-50 shadow-xs overflow-hidden adobe-dark:border-rose-500/40 adobe-dark:bg-rose-500/10">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rose-200 p-6 adobe-dark:border-rose-500/30">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-rose-600 text-white flex items-center justify-center">
            <IconAlertTriangle size={20} stroke={2} />
          </div>
          <div>
            <h3 className="text-base font-bold text-rose-700 adobe-dark:text-rose-300">
              {pendencias.length === 1
                ? 'Conta fixa não paga'
                : `${pendencias.length} contas fixas não pagas`}
            </h3>
            <p className="text-xs text-rose-600 mt-0.5 adobe-dark:text-rose-300/80">
              Vencidas e ainda sem pagamento, de qualquer mês. Somem daqui quando forem pagas.
            </p>
          </div>
        </div>
        <span className="text-lg font-black text-rose-700 adobe-dark:text-rose-300">
          {formatCurrency(total)}
        </span>
      </div>
      <ul className="divide-y divide-rose-200 adobe-dark:divide-rose-500/30">
        {pendencias.map((p) => (
          <li
            key={`${p.conta.id}_${p.mes}`}
            className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm text-rose-800 adobe-dark:text-rose-200">
                  {p.conta.nome}
                </span>
                <span className="inline-flex items-center rounded-full border border-rose-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 adobe-dark:border-rose-500/30 adobe-dark:bg-rose-500/15 adobe-dark:text-rose-300">
                  Vencida
                </span>
              </div>
              <p className="mt-1 text-xs text-rose-600 adobe-dark:text-rose-300/80">
                Referente a {rotuloMes(p.mes)} · venceu {dataBR(p.vencimento)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <span className="text-sm font-black text-rose-700 adobe-dark:text-rose-300">
                {formatCurrency(p.conta.valor)}
              </span>
              <Button
                variant="liberty"
                size="sm"
                disabled={navegando}
                leftIcon={<IconCircleCheck size={16} />}
                onClick={() => setPagando(p)}
              >
                Marcar como paga
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <ModalPagamentoContaFixa alvo={pagando} onClose={() => setPagando(null)} />
    </div>
  )
}
