import Link from 'next/link'
import { IconAlertTriangle } from '@tabler/icons-react'
import { EmptyState } from '../../components/ui'
import type { AnalyticsOverview } from './data'
import VisitorsChart from './VisitorsChart'

function fmt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

/** "1,3 páginas por visitante", ou nada quando não há visitantes. */
function porVisitante(pageviews: number, visitantes: number): string | undefined {
  if (visitantes <= 0) return undefined
  const media = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(pageviews / visitantes)
  return `${media} páginas por visitante`
}

/** Célula de um painel único de números (sem ícone), separada das vizinhas por linhas. */
function Celula({
  titulo,
  valor,
  rodape,
  barra,
  extra,
}: {
  titulo: string
  valor: string
  rodape: string
  /** Proporção logados × anônimos, desenhada como barra (só nas células de visitantes). */
  barra?: { logados: number; anonimos: number }
  /** Linha extra de contexto abaixo do rodapé. */
  extra?: string
}) {
  const total = barra ? barra.logados + barra.anonimos : 0
  return (
    <div className="p-6">
      <span className="block text-[10px] font-extrabold uppercase leading-4 tracking-widest text-neutral-400 sm:min-h-8 adobe-dark:text-adobe-text-lo">
        {titulo}
      </span>
      <p className="mt-2 text-2xl font-black text-neutral-950 adobe-dark:text-adobe-text-hi">{valor}</p>
      {/* Faixa de altura fixa em todas as células, para manter o alinhamento. */}
      <div className="mt-3 h-1.5" aria-hidden={!barra}>
        {barra && (
          <div
            className="flex h-full overflow-hidden rounded-full bg-neutral-200 adobe-dark:bg-adobe-bg-3"
            role="img"
            aria-label={`${barra.logados} logados e ${barra.anonimos} anônimos`}
          >
            {total > 0 && (
              <>
                <div className="bg-emerald-500" style={{ width: `${(barra.logados / total) * 100}%` }} />
                <div className="bg-liberty" style={{ width: `${(barra.anonimos / total) * 100}%` }} />
              </>
            )}
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-neutral-500 adobe-dark:text-adobe-text-lo">{rodape}</p>
      {extra && <p className="mt-0.5 text-xs font-semibold text-neutral-700 adobe-dark:text-adobe-text-md">{extra}</p>}
    </div>
  )
}

export default function AnalyticsView({ dados }: { dados: AnalyticsOverview }) {
  const { hoje, mes, serie30, topVeiculos, erro } = dados
  const anonHoje = Math.max(0, hoje.uniqueVisitors - hoje.loggedVisitors)
  const anonMes = Math.max(0, mes.uniqueVisitors - mes.loggedVisitors)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-liberty-deep adobe-dark:text-adobe-accent-soft">
          Analytics
        </p>
        <h1 className="text-2xl font-black text-neutral-950 adobe-dark:text-adobe-text-hi">
          Visitantes do site
        </h1>
        <p className="text-sm text-neutral-500 adobe-dark:text-adobe-text-lo">
          Cada &quot;visitante&quot; é um navegador/dispositivo único (identificado por um
          cookie). A navegação interna do painel não é contabilizada.
        </p>
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 adobe-dark:border-amber-500/30 adobe-dark:bg-amber-500/10 adobe-dark:text-amber-300">
          <IconAlertTriangle size={16} />
          Não foi possível carregar os dados agora. Tente recarregar em instantes.
        </div>
      )}

      <div className="grid overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs divide-y divide-neutral-200 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 [&>*]:border-neutral-200 sm:[&>*:nth-child(even)]:border-l sm:[&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0 lg:[&>*:not(:first-child)]:border-l adobe-dark:divide-adobe-line adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2 adobe-dark:[&>*]:border-adobe-line">
        <Celula
          titulo="Visitantes hoje"
          valor={fmt(hoje.uniqueVisitors)}
          rodape={`${fmt(hoje.loggedVisitors)} logados · ${fmt(anonHoje)} anônimos`}
          barra={{ logados: hoje.loggedVisitors, anonimos: anonHoje }}
        />
        <Celula
          titulo={`Visitantes em ${mes.label}`}
          valor={fmt(mes.uniqueVisitors)}
          rodape={`${fmt(mes.loggedVisitors)} logados · ${fmt(anonMes)} anônimos`}
          barra={{ logados: mes.loggedVisitors, anonimos: anonMes }}
        />
        <Celula
          titulo="Pageviews hoje"
          valor={fmt(hoje.pageviews)}
          rodape="Páginas abertas hoje (com recargas)"
          extra={porVisitante(hoje.pageviews, hoje.uniqueVisitors)}
        />
        <Celula
          titulo={`Pageviews em ${mes.label}`}
          valor={fmt(mes.pageviews)}
          rodape="Páginas abertas no mês (com recargas)"
          extra={porVisitante(mes.pageviews, mes.uniqueVisitors)}
        />
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">
            Visitantes únicos por dia — últimos 30 dias
          </h2>
          <div className="flex items-center gap-4 text-xs text-neutral-500 adobe-dark:text-adobe-text-lo">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-liberty" /> Total
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Logados
            </span>
          </div>
        </div>
        <div className="mt-4">
          <VisitorsChart serie={serie30} />
        </div>
        <p className="mt-3 text-[11px] text-neutral-400 adobe-dark:text-adobe-text-lo">
          Somar os dias não dá o total do mês — quem volta em dias diferentes conta
          em cada dia. O número do mês está no cartão acima.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2">
        <h2 className="text-sm font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">
          Veículos mais vistos — últimos 30 dias
        </h2>
        {topVeiculos.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              size="sm"
              title="Ainda sem visualizações registradas"
              description="Assim que os visitantes abrirem páginas de veículos, o ranking aparece aqui."
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-neutral-400 adobe-dark:text-adobe-text-lo">
                  <th className="w-10 pb-2">#</th>
                  <th className="pb-2">Veículo</th>
                  <th className="w-28 pb-2 text-right">Visualizações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 adobe-dark:divide-adobe-line">
                {topVeiculos.map((v, i) => (
                  <tr key={v.id} className="text-neutral-800 adobe-dark:text-adobe-text-hi">
                    <td className="py-2.5 font-semibold text-neutral-400">{i + 1}</td>
                    <td className="py-2.5">
                      {v.existe ? (
                        <Link
                          href={`/dashboard/veiculos?veiculoId=${v.id}`}
                          className="font-medium text-liberty-deep hover:underline adobe-dark:text-adobe-accent-soft"
                        >
                          {v.nome}
                        </Link>
                      ) : (
                        <span>
                          {v.nome}{' '}
                          <span className="text-xs text-neutral-400">({v.id})</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-bold tabular-nums">
                      {fmt(v.views)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
