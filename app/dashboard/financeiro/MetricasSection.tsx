'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconArrowDownRight, IconArrowUpRight, IconMinus, IconTable } from '@tabler/icons-react'
import { formatCurrency } from '@/utils/format'
import { rotuloMes, rotuloMesCurto } from './periodo'
import { METRICAS_PERIODOS, type MetricasFinanceiro, type MetricasMes, type MetricasPeriodo } from './metricas-types'

// Cores validadas (dataviz, light e dark): categóricos 1 e 2 para faturamento
// e custos; vermelho para lucro negativo. Texto nunca usa a cor da série.
const COR = {
  faturamento: 'bg-[#2a78d6] adobe-dark:bg-[#3987e5]',
  custos: 'bg-[#eb6834] adobe-dark:bg-[#d95926]',
  negativo: 'bg-[#e34948] adobe-dark:bg-[#e66767]',
}

const CARD =
  'rounded-2xl border border-neutral-200 bg-white shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2'

const inteiro = (n: number) => n.toLocaleString('pt-BR')

/** Valor compacto para eixo: R$ 12 mil, R$ 1,2 mi. */
function moedaCompacta(n: number) {
  const abs = Math.abs(n)
  const sinal = n < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (abs >= 1_000) return `${sinal}R$ ${(abs / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  return `${sinal}R$ ${abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

export default function MetricasSection({ metricas }: { metricas: MetricasFinanceiro }) {
  const router = useRouter()
  const [verTabela, setVerTabela] = useState(false)
  const { meses, periodo } = metricas
  const atual = meses[meses.length - 1]
  const anterior = meses[meses.length - 2]

  function irParaPeriodo(p: MetricasPeriodo) {
    if (p === periodo) return
    router.push(`/dashboard?meses=${p}`)
  }

  return (
    <div className="space-y-5">
      {/* Período */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <div className="inline-flex gap-1 rounded-lg border border-neutral-200 p-1 adobe-dark:border-adobe-line">
          {METRICAS_PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => irParaPeriodo(p)}
              aria-pressed={periodo === p}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                periodo === p
                  ? 'bg-neutral-950 text-white adobe-dark:bg-adobe-accent adobe-dark:text-[#0a1720]'
                  : 'text-neutral-600 hover:bg-neutral-100 adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-3'
              }`}
            >
              {p} meses
            </button>
          ))}
        </div>
        <span className="text-xs text-neutral-500 adobe-dark:text-adobe-text-lo">
          {rotuloMesCurto(meses[0].mes)} a {rotuloMesCurto(atual.mes)} · lançamentos concluídos
        </span>
        <button
          type="button"
          onClick={() => setVerTabela((v) => !v)}
          aria-pressed={verTabela}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer adobe-dark:border-adobe-line adobe-dark:text-adobe-text-md adobe-dark:hover:bg-adobe-bg-3"
        >
          <IconTable size={14} stroke={2} />
          {verTabela ? 'Ver gráficos' : 'Ver tabela'}
        </button>
      </div>

      {/* Mês atual vs anterior */}
      <section aria-label={`Resumo de ${rotuloMes(atual.mes)}`} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi rotulo="Faturamento" formatar={formatCurrency} atual={atual.faturamento} anterior={anterior?.faturamento} />
        <Kpi rotulo="Custos" formatar={formatCurrency} atual={atual.custos} anterior={anterior?.custos} />
        <Kpi rotulo="Lucro" formatar={formatCurrency} atual={atual.lucro} anterior={anterior?.lucro} />
        <Kpi rotulo="Veículos adquiridos" formatar={inteiro} atual={atual.veiculos} anterior={anterior?.veiculos} />
        <Kpi rotulo="Manutenções" formatar={inteiro} atual={atual.manutencoes} anterior={anterior?.manutencoes} />
      </section>
      <p className="-mt-2 text-[11px] text-neutral-500 adobe-dark:text-adobe-text-lo">
        {rotuloMes(atual.mes)} (mês em aberto) comparado com {anterior ? rotuloMes(anterior.mes) : 'o mês anterior'}.
      </p>

      {verTabela ? (
        <TabelaMetricas meses={meses} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Grafico
            titulo="Faturamento e custos"
            meses={meses}
            series={[
              { nome: 'Faturamento', cor: COR.faturamento, valor: (m) => m.faturamento },
              { nome: 'Custos', cor: COR.custos, valor: (m) => m.custos },
            ]}
            formatarEixo={moedaCompacta}
            formatarValor={formatCurrency}
          />
          <Grafico
            titulo="Lucro (faturamento − custos)"
            meses={meses}
            series={[{ nome: 'Lucro', cor: COR.faturamento, corNegativo: COR.negativo, valor: (m) => m.lucro }]}
            formatarEixo={moedaCompacta}
            formatarValor={formatCurrency}
          />
          <Grafico
            titulo="Veículos adquiridos"
            meses={meses}
            series={[{ nome: 'Veículos', cor: COR.faturamento, valor: (m) => m.veiculos }]}
            formatarEixo={inteiro}
            formatarValor={(n) => `${inteiro(n)} ${n === 1 ? 'veículo' : 'veículos'}`}
            extra={(m) => (m.veiculosValor > 0 ? `Aquisição: ${formatCurrency(m.veiculosValor)}` : null)}
            inteiros
          />
          <Grafico
            titulo="Manutenções pagas"
            meses={meses}
            series={[{ nome: 'Manutenções', cor: COR.faturamento, valor: (m) => m.manutencoes }]}
            formatarEixo={inteiro}
            formatarValor={(n) => `${inteiro(n)} ${n === 1 ? 'manutenção' : 'manutenções'}`}
            extra={(m) => (m.manutencoesValor > 0 ? `Gasto: ${formatCurrency(m.manutencoesValor)}` : null)}
            inteiros
          />
        </div>
      )}
    </div>
  )
}

// ─── Card do mês ─────────────────────────────────────────────────────────────

function Kpi({
  rotulo,
  formatar,
  atual,
  anterior,
}: {
  rotulo: string
  formatar: (n: number) => string
  atual: number
  anterior?: number
}) {
  const valor = formatar(atual)
  let variacao: { icone: React.ReactNode; texto: string } | null = null
  if (anterior !== undefined) {
    if (atual === anterior) variacao = { icone: <IconMinus size={12} stroke={2.5} />, texto: 'igual' }
    else if (anterior === 0) {
      variacao = { icone: <IconArrowUpRight size={12} stroke={2.5} />, texto: 'novo' }
    } else {
      const pct = ((atual - anterior) / Math.abs(anterior)) * 100
      variacao = {
        icone: pct > 0 ? <IconArrowUpRight size={12} stroke={2.5} /> : <IconArrowDownRight size={12} stroke={2.5} />,
        texto: `${pct > 0 ? '+' : ''}${pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`,
      }
    }
  }
  return (
    <div className={CARD + ' p-4'}>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 adobe-dark:text-adobe-text-lo">{rotulo}</p>
      <p className="mt-1 truncate text-xl font-bold tabular-nums text-neutral-950 adobe-dark:text-adobe-text-hi">{valor}</p>
      {variacao && (
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500 adobe-dark:text-adobe-text-lo">
          {variacao.icone}
          {variacao.texto}
        </p>
      )}
      {anterior !== undefined && (
        <p className="truncate text-[11px] text-neutral-400 adobe-dark:text-adobe-text-lo">Mês anterior: {formatar(anterior)}</p>
      )}
    </div>
  )
}

// ─── Gráfico de barras (HTML; sem dependência) ───────────────────────────────

interface Serie {
  nome: string
  /** Classes de fundo da barra (light + dark). */
  cor: string
  /** Cor para valores negativos (lucro). */
  corNegativo?: string
  valor: (m: MetricasMes) => number
}

/** Teto "redondo" para o eixo (1, 2, 2,5, 5 × 10^n). */
function tetoRedondo(v: number, inteiros: boolean) {
  if (v <= 0) return inteiros ? 4 : 1000
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const passo = [1, 2, 2.5, 5, 10].find((f) => f * exp >= v)! * exp
  return inteiros ? Math.max(4, Math.ceil(passo)) : passo
}

function Grafico({
  titulo,
  meses,
  series,
  formatarEixo,
  formatarValor,
  extra,
  inteiros = false,
}: {
  titulo: string
  meses: MetricasMes[]
  series: Serie[]
  formatarEixo: (n: number) => string
  formatarValor: (n: number) => string
  extra?: (m: MetricasMes) => string | null
  inteiros?: boolean
}) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const valores = meses.flatMap((m) => series.map((s) => s.valor(m)))
  const max = tetoRedondo(Math.max(0, ...valores), inteiros)
  const minBruto = Math.min(0, ...valores)
  const min = minBruto < 0 ? -tetoRedondo(-minBruto, inteiros) : 0
  const faixa = max - min
  const zeroPct = (max / faixa) * 100 // distância do topo até a linha do zero
  const linhas = min < 0 ? [max, 0, min] : [max, max / 2, 0]

  return (
    <figure className={CARD + ' p-4'}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">{titulo}</span>
        {series.length > 1 && (
          <span className="flex items-center gap-3">
            {series.map((s) => (
              <span key={s.nome} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-600 adobe-dark:text-adobe-text-md">
                <span className={`h-2.5 w-2.5 rounded-sm ${s.cor}`} aria-hidden />
                {s.nome}
              </span>
            ))}
          </span>
        )}
      </figcaption>

      <div className="mt-4 flex gap-2">
        {/* Eixo Y */}
        <div className="relative h-44 w-14 shrink-0 text-right text-[10px] tabular-nums text-neutral-400 adobe-dark:text-adobe-text-lo">
          {linhas.map((v) => (
            <span
              key={v}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${((max - v) / faixa) * 100}%` }}
            >
              {formatarEixo(v)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-44">
            {/* Grade recessiva + linha do zero */}
            {linhas.map((v) => (
              <div
                key={v}
                aria-hidden
                className={`absolute inset-x-0 border-t ${
                  v === 0 ? 'border-neutral-300 adobe-dark:border-[#383835]' : 'border-neutral-100 adobe-dark:border-[#2c2c2a]'
                }`}
                style={{ top: `${((max - v) / faixa) * 100}%` }}
              />
            ))}

            <div className="absolute inset-0 flex">
              {meses.map((m, i) => (
                <div
                  key={m.mes}
                  className="relative flex h-full min-w-0 flex-1 justify-center gap-0.5 px-1.5 outline-none sm:px-3"
                  tabIndex={0}
                  role="img"
                  aria-label={`${rotuloMes(m.mes)}: ${series.map((s) => `${s.nome} ${formatarValor(s.valor(m))}`).join(', ')}`}
                  onMouseEnter={() => setAtivo(i)}
                  onMouseLeave={() => setAtivo(null)}
                  onFocus={() => setAtivo(i)}
                  onBlur={() => setAtivo(null)}
                >
                  {ativo === i && (
                    <div aria-hidden className="absolute inset-y-0 inset-x-0 rounded-md bg-neutral-100/70 adobe-dark:bg-white/5" />
                  )}
                  {series.map((s) => {
                    const v = s.valor(m)
                    const alturaPct = (Math.abs(v) / faixa) * 100
                    const negativo = v < 0
                    return (
                      <div key={s.nome} className="relative h-full w-full max-w-[28px]">
                        <div
                          className={`absolute inset-x-0 ${negativo ? 'rounded-b-[4px]' : 'rounded-t-[4px]'} ${
                            negativo && s.corNegativo ? s.corNegativo : s.cor
                          }`}
                          style={
                            negativo
                              ? { top: `${zeroPct}%`, height: `${alturaPct}%` }
                              : { bottom: `${100 - zeroPct}%`, height: `${alturaPct}%` }
                          }
                        />
                      </div>
                    )
                  })}

                  {ativo === i && (
                    <div
                      role="tooltip"
                      className={`pointer-events-none absolute top-1 z-10 w-max min-w-36 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-lg adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-3 ${
                        i >= meses.length / 2 ? 'right-1/2' : 'left-1/2'
                      }`}
                    >
                      <p className="mb-1 font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">{rotuloMes(m.mes)}</p>
                      {series.map((s) => (
                        <p key={s.nome} className="flex items-center justify-between gap-3 text-neutral-600 adobe-dark:text-adobe-text-md">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              aria-hidden
                              className={`h-2 w-2 rounded-sm ${s.valor(m) < 0 && s.corNegativo ? s.corNegativo : s.cor}`}
                            />
                            {s.nome}
                          </span>
                          <span className="font-semibold tabular-nums text-neutral-900 adobe-dark:text-adobe-text-hi">
                            {formatarValor(s.valor(m))}
                          </span>
                        </p>
                      ))}
                      {extra?.(m) && <p className="mt-1 text-[11px] text-neutral-500 adobe-dark:text-adobe-text-lo">{extra(m)}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Eixo X */}
          <div className="mt-1.5 flex">
            {meses.map((m) => (
              <span
                key={m.mes}
                className="flex-1 truncate text-center text-[10px] font-semibold text-neutral-500 adobe-dark:text-adobe-text-lo"
              >
                {rotuloMesCurto(m.mes).replace(/\/\d{2}(\d{2})$/, '/$1')}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}

// ─── Tabela (alternativa acessível aos gráficos) ─────────────────────────────

function TabelaMetricas({ meses }: { meses: MetricasMes[] }) {
  const linhas = [...meses].reverse()
  const TH = 'px-3 py-2 text-right text-[10px] font-extrabold uppercase tracking-wider text-neutral-500 adobe-dark:text-adobe-text-lo'
  const TD = 'px-3 py-2 text-right tabular-nums text-neutral-800 adobe-dark:text-adobe-text-hi'
  return (
    <div className={CARD + ' overflow-x-auto'}>
      <table className="w-full min-w-[720px] text-xs">
        <thead className="border-b border-neutral-200 adobe-dark:border-adobe-line">
          <tr>
            <th className={TH + ' text-left'}>Mês</th>
            <th className={TH}>Faturamento</th>
            <th className={TH}>Custos</th>
            <th className={TH}>Lucro</th>
            <th className={TH}>Veículos</th>
            <th className={TH}>Aquisição</th>
            <th className={TH}>Manutenções</th>
            <th className={TH}>Gasto manut.</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((m) => (
            <tr key={m.mes} className="border-b border-neutral-100 last:border-0 adobe-dark:border-adobe-line">
              <td className={TD + ' text-left font-semibold'}>{rotuloMes(m.mes)}</td>
              <td className={TD}>{formatCurrency(m.faturamento)}</td>
              <td className={TD}>{formatCurrency(m.custos)}</td>
              <td className={TD + ' font-semibold'}>{formatCurrency(m.lucro)}</td>
              <td className={TD}>{inteiro(m.veiculos)}</td>
              <td className={TD}>{formatCurrency(m.veiculosValor)}</td>
              <td className={TD}>{inteiro(m.manutencoes)}</td>
              <td className={TD}>{formatCurrency(m.manutencoesValor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
