import Link from 'next/link'
import { IconAlertTriangle, IconCalendarEvent, IconChecks, IconTool } from '@tabler/icons-react'
import { Breadcrumb, EmptyState } from '@/app/components/ui'
import { formatDate } from '@/utils/format'
import { PENDENCIA_ORIGEM_LABEL, type Pendencia } from '@/utils/pendencias/types'

const CARD =
  'rounded-2xl border border-neutral-200 bg-white shadow-xs adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2'

/** Aba Pendências de Demandas: o que está esperando execução nos outros módulos. */
export default function PendenciasClient({ pendencias }: { pendencias: Pendencia[] }) {
  const atrasadas = pendencias.filter((p) => p.atrasada).length

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Demandas', href: '/dashboard/demandas' },
          { label: 'Pendências' },
        ]}
      />
      <div>
        <h1 className="text-xl font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">Pendências</h1>
        <p className="mt-1 text-sm text-neutral-600 adobe-dark:text-adobe-text-md">
          Serviços que precisam ser executados em outros módulos. Cada item some daqui quando é concluído
          no módulo de origem.
        </p>
      </div>

      {atrasadas > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 adobe-dark:border-red-500/40 adobe-dark:bg-red-500/10 adobe-dark:text-red-300">
          <IconAlertTriangle size={18} />
          {atrasadas === 1 ? '1 pendência atrasada' : `${atrasadas} pendências atrasadas`}
        </div>
      )}

      {pendencias.length === 0 ? (
        <EmptyState
          icon={<IconChecks size={28} />}
          title="Nenhuma pendência"
          description="Tudo em dia por aqui."
        />
      ) : (
        <ul className="space-y-2">
          {pendencias.map((p) => (
            <li key={p.id}>
              <Link
                href={p.href}
                className={`${CARD} flex items-start gap-3 p-4 transition-colors hover:border-liberty`}
              >
                <span
                  className={
                    'mt-0.5 rounded-lg p-2 ' +
                    (p.atrasada
                      ? 'bg-red-100 text-red-700 adobe-dark:bg-red-500/15 adobe-dark:text-red-300'
                      : 'bg-neutral-100 text-neutral-600 adobe-dark:bg-adobe-bg-3 adobe-dark:text-adobe-text-md')
                  }
                >
                  <IconTool size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">
                    {p.titulo}
                  </span>
                  {p.detalhe && (
                    <span className="mt-0.5 block text-xs text-neutral-600 adobe-dark:text-adobe-text-md">
                      {p.detalhe}
                    </span>
                  )}
                  <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-neutral-600 adobe-dark:border-adobe-line adobe-dark:text-adobe-text-md">
                      {PENDENCIA_ORIGEM_LABEL[p.origem]}
                    </span>
                    <span
                      className={
                        'inline-flex items-center gap-1 ' +
                        (p.atrasada ? 'text-red-700 adobe-dark:text-red-300' : 'text-neutral-600 adobe-dark:text-adobe-text-md')
                      }
                    >
                      <IconCalendarEvent size={12} />
                      {p.data ? formatDate(p.data) : 'Sem data'}
                      {p.atrasada ? ' · atrasada' : p.venceHoje ? ' · hoje' : ''}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
