'use client'

import { useState } from 'react'
import { IconCheck, IconCopy } from '@tabler/icons-react'

export default function CopiarLink({ link, mensagem }: { link: string; mensagem: string }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      // Sem permissão da área de transferência: a pessoa ainda pode selecionar o link manualmente.
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold" htmlFor="link-indicacao">Seu link exclusivo</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="link-indicacao"
          readOnly
          value={link}
          onFocus={(evento) => evento.currentTarget.select()}
          placeholder="Seu link aparecerá aqui"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--portal-borda)] bg-transparent px-3 text-sm"
        />
        <button type="button" onClick={copiar} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--portal-borda)] px-4 text-sm font-semibold hover:bg-[var(--portal-selecao)]">
          {copiado ? <IconCheck size={17} aria-hidden /> : <IconCopy size={17} aria-hidden />}
          {copiado ? 'Link copiado' : 'Copiar link'}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${mensagem} ${link}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--portal-borda)] px-4 text-sm font-semibold hover:bg-[var(--portal-selecao)]"
        >
          Compartilhar no WhatsApp
        </a>
      </div>
    </div>
  )
}
