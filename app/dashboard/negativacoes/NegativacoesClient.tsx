'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDate } from '@/utils/format'
import MarcaAsaas from '@/app/components/MarcaAsaas'
import MarcaSerasa from '@/app/components/MarcaSerasa'
import NegativacaoBox from '@/app/dashboard/cobrancas/NegativacaoBox'
import type { LinhaNegativacao } from '@/app/dashboard/cobrancas/negativacao-actions'

const ATIVAS = ['PENDING', 'AWAITING_APPROVAL', 'AWAITING_CANCELLATION', 'PROCESSED', 'PARTIALLY_PAID']

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
  onMudou: (r: { success?: string; error?: string }) => void
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

export default function NegativacoesClient({
  linhas,
  podeNegativar,
}: {
  linhas: LinhaNegativacao[]
  podeNegativar: boolean
}) {
  const router = useRouter()
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const emAndamento = linhas.filter((l) => l.negativacao && ATIVAS.includes(l.negativacao.status))
  const encerradas = linhas.filter((l) => l.negativacao && !ATIVAS.includes(l.negativacao.status))
  const candidatas = linhas.filter((l) => !l.negativacao && l.statusCobranca === 'vencida')

  function onMudou(r: { success?: string; error?: string }) {
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
      <Lista
        titulo="Cobranças vencidas, sem negativação"
        vazio="Nenhuma cobrança vencida no momento."
        linhas={candidatas}
        podeNegativar={podeNegativar}
        onMudou={onMudou}
      />
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
