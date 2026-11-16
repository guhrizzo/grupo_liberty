import Link from 'next/link'
import { IconFileDownload, IconFilePencil } from '@tabler/icons-react'

/** Atalho da aba Contratos para a página de escolha do modelo de contrato. */
export default function GerarContratoSection() {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-neutral-700">
            <IconFilePencil size={18} className="text-liberty-deep" />
            Gerar contrato preenchido
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Escolha o modelo, preencha os dados e baixe o contrato pronto em PDF.
          </p>
        </div>
        <Link
          href="/dashboard/contratos/gerar"
          className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-liberty px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-ui hover:bg-liberty-deep hover:shadow-lg hover:shadow-liberty/25 adobe-dark:bg-[var(--color-adobe-accent)] adobe-dark:text-[#0a1720] adobe-dark:hover:bg-[var(--color-adobe-accent-deep)]"
        >
          <IconFileDownload size={14} />
          Gerar contrato
        </Link>
      </div>
    </section>
  )
}
