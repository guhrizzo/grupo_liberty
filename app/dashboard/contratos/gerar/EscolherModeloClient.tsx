import Link from 'next/link'
import { IconArrowLeft, IconArrowRight, IconFileText, IconReceipt } from '@tabler/icons-react'
import { TIPOS_CONTRATO_GERADO } from './types'

const CARD =
  'group flex h-full w-full cursor-pointer flex-col rounded-2xl border border-neutral-200 bg-white p-6 text-left shadow-xs transition-ui hover:-translate-y-0.5 hover:border-liberty/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-liberty/40 adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-2'

/** Cada modelo tem a sua página: /dashboard/contratos/gerar/<modelo>. */
export default function EscolherModeloClient() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-liberty">Contratos</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-950 md:text-4xl">Modelos de contrato</h1>
          <p className="mt-1 text-xs text-neutral-500 md:text-sm">Escolha o modelo, preencha os campos e gere o PDF.</p>
        </div>
        <Link
          href="/dashboard/contratos"
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition-ui hover:bg-neutral-50 md:px-4"
        >
          <IconArrowLeft size={14} stroke={2.5} />
          <span className="hidden sm:inline">Voltar para Contratos</span>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TIPOS_CONTRATO_GERADO.map((t) => (
          <Link key={t.value} href={`/dashboard/contratos/gerar/${t.value}`} className={CARD}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-liberty/10 text-liberty">
              <IconFileText size={22} stroke={1.8} />
            </span>
            <span className="mt-5 block text-lg font-extrabold leading-snug text-neutral-950">{t.label}</span>
            <span className="mt-2 block flex-1 text-sm leading-relaxed text-neutral-500">{t.descricao}</span>
            <span className="mt-6 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-liberty-deep">
              Preencher contrato
              <IconArrowRight size={14} stroke={2.5} className="transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </Link>
        ))}

        <Link href="/dashboard/contratos/gerar/recibo" className={CARD}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-liberty/10 text-liberty">
            <IconReceipt size={22} stroke={1.8} />
          </span>
          <span className="mt-5 block text-lg font-extrabold leading-snug text-neutral-950">Recibo de pagamento</span>
          <span className="mt-2 block flex-1 text-sm leading-relaxed text-neutral-500">
            Recibo do valor recebido por um veículo, com os dados do cliente, do veículo e do pagamento (total e saldo opcionais).
          </span>
          <span className="mt-6 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-liberty-deep">
            Gerar recibo
            <IconArrowRight size={14} stroke={2.5} className="transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </div>
  )
}
