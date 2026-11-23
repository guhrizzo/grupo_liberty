import type { ReactNode } from 'react'
import { formatDate } from '@/utils/format'
import { formatarCentavosInvestimento, TIPOS_MOVIMENTO, type MovimentoInvestimento, type TotaisInvestimento } from '@/utils/investimentos/modelo'

type ItemExtrato = Pick<MovimentoInvestimento, 'tipo' | 'valor' | 'descricao' | 'data'> & {
  id: string; estornado: boolean; estornoDe: string | null
}

const cartao = 'rounded-xl border border-neutral-200 bg-white p-5'

export function ResumoInvestimento({ totais }: { totais: TotaisInvestimento }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {([
        ['Saldo registrado', totais.saldo],
        ['Total aportado', totais.aportes],
        ['Total resgatado', totais.resgates],
        ['Resultado informado', totais.resultado],
      ] as const).map(([rotulo, valor]) => (
        <div key={rotulo} className={cartao}>
          <dt className="text-sm text-neutral-600">{rotulo}</dt>
          <dd className="mt-1 break-words text-lg font-semibold text-neutral-900">
            {formatarCentavosInvestimento(valor)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function ExtratoInvestimento({ movimentos, acoes }: {
  movimentos: ItemExtrato[]
  acoes?: (movimento: ItemExtrato) => ReactNode
}) {
  return (
    <section className={cartao} aria-labelledby="titulo-extrato">
      <h2 id="titulo-extrato" className="font-semibold text-neutral-900">Movimentações</h2>
      {movimentos.length ? (
        <ol className="mt-2 divide-y divide-neutral-200">
          {movimentos.map((movimento) => {
            const { id, tipo, data, descricao, valor, estornado } = movimento
            const nome = tipo === 'estorno' ? 'Estorno de lançamento' : TIPOS_MOVIMENTO.find(({ value }) => value === tipo)?.label
            return (
              <li key={id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold">{nome}{estornado && ' · Estornado'}</p>
                    <p className="text-neutral-600">{formatDate(data)}{descricao && ` · ${descricao}`}</p>
                  </div>
                  <span className="font-medium tabular-nums">{formatarCentavosInvestimento(tipo === 'resgate' ? -valor : valor)}</span>
                </div>
                {acoes?.(movimento)}
              </li>
            )
          })}
        </ol>
      ) : <p className="mt-2 text-sm text-neutral-600">Nenhuma movimentação registrada.</p>}
    </section>
  )
}
