'use client'

import { useState } from 'react'
import { Select } from '@/app/components/ui'
import type { Indicadores } from '@/utils/indicacoes/indicadores'

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percentual = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })
const mes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export default function IndicadoresIndicacoes({ indicadores, podeVerResultado }: {
  indicadores: Indicadores
  podeVerResultado: boolean
}) {
  const [periodo, setPeriodo] = useState('')
  const resumo = indicadores.find((item) => item.periodo === periodo) ?? indicadores[0]
  const monetario = (valor: number | null) => valor === null ? '—' : moeda.format(valor)
  const metricas = [
    ['Indicações recebidas', resumo.total],
    ['Conversão no portal', resumo.total ? percentual.format(resumo.convertidas / resumo.total) : '—'],
    ['Conversão em operação', resumo.total ? percentual.format(resumo.comOperacao / resumo.total) : '—'],
    ['Operações originadas', resumo.compras + resumo.vendas, `${resumo.compras} compras · ${resumo.vendas} vendas`],
    ['Recompensas pagas', monetario(resumo.totalPago)],
    ['Custo por cliente adquirido', monetario(resumo.custoAquisicao), `${resumo.comOperacao} clientes com operação`],
  ]
  if (podeVerResultado) metricas.push([
    'Margem bruta das vendas', monetario(resumo.margemVendas), `${resumo.vendasComMargem} de ${resumo.vendas} vendas com preço e custo`,
  ])

  return (
    <section aria-labelledby="indicadores-indicacoes" className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="indicadores-indicacoes" className="font-semibold">Indicadores de Indique e ganhe</h2>
        <Select label="Mês de cadastro da indicação" value={resumo.periodo} onChange={(e) => setPeriodo(e.target.value)}
          options={indicadores.map(({ periodo }) => ({
            value: periodo, label: periodo ? mes.format(new Date(`${periodo}-01T12:00:00Z`)) : 'Todo o histórico',
          }))} />
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metricas.map(([label, valor, detalhe]) => (
          <div key={label} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
            <dt className="text-sm text-neutral-600 dark:text-neutral-400">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{valor}</dd>
            {detalhe && <dd className="text-xs text-neutral-600 dark:text-neutral-400">{detalhe}</dd>}
          </div>
        ))}
      </dl>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Os totais acompanham as indicações cadastradas no período selecionado, incluindo seus pagamentos e operações posteriores.
        O custo por cliente usa as recompensas pagas.
      </p>
      <h3 className="font-semibold">Ranking de indicadores</h3>
      {resumo.ranking.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr><th scope="col">Cliente</th><th scope="col">Indicações</th><th scope="col">Conversões</th><th scope="col">Operações</th></tr>
            </thead>
            <tbody>
              {resumo.ranking.map((linha, indice) => (
                <tr key={indice} className="border-t border-neutral-200 dark:border-neutral-700">
                  <th scope="row" className="py-2 pr-4 font-medium">{linha.nome}</th>
                  <td>{linha.indicacoes}</td><td>{linha.convertidas}</td><td>{linha.operacoes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-neutral-600 dark:text-neutral-400">Nenhuma indicação no período.</p>}
    </section>
  )
}
