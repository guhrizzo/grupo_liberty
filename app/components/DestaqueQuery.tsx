'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { IconTargetArrow } from '@tabler/icons-react'

const DURACAO_MS = 3200

/**
 * Destaca na página o item apontado por `?destaque=<id>` (usado pelo sino de
 * pendências). O item precisa ter `data-destaque="<id>"`. Rola até ele, pisca
 * um anel ao redor por alguns segundos e mostra um aviso fixo; depois limpa o
 * parâmetro da URL. Se o item não existe mais (já foi concluído), avisa.
 */
export default function DestaqueQuery() {
  const params = useSearchParams()
  const param = params.get('destaque')
  // O parâmetro é limpo da URL logo ao começar; `id` guarda o alvo até o fim do destaque.
  const [id, setId] = useState<string | null>(null)
  const [aviso, setAviso] = useState<'achou' | 'sumiu' | null>(null)

  useEffect(() => {
    if (param) setId(param)
  }, [param])

  useEffect(() => {
    if (!id) return
    let el: HTMLElement | null = null
    let tentativas = 0
    let fim: ReturnType<typeof setTimeout> | undefined

    const procurar = setInterval(() => {
      tentativas++
      el = document.querySelector<HTMLElement>(`[data-destaque="${CSS.escape(id)}"]`)
      if (el) {
        clearInterval(procurar)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('destaque-item')
        setAviso('achou')
        fim = setTimeout(() => {
          el?.classList.remove('destaque-item')
          setAviso(null)
          setId(null)
        }, DURACAO_MS)
      } else if (tentativas >= 30) {
        clearInterval(procurar)
        setAviso('sumiu')
        fim = setTimeout(() => {
          setAviso(null)
          setId(null)
        }, 5000)
      }
    }, 100)

    // Limpa o parâmetro para um F5 não destacar de novo.
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('destaque')
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    } catch {
      // sem History API: segue sem limpar
    }

    return () => {
      clearInterval(procurar)
      if (fim) clearTimeout(fim)
      el?.classList.remove('destaque-item')
    }
  }, [id])

  if (!aviso) return null
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
    >
      <div className="destaque-aviso flex items-center gap-2 rounded-full bg-liberty px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
        <IconTargetArrow size={18} />
        {aviso === 'achou'
          ? 'É aqui: o item da notificação está destacado'
          : 'Esse item não está mais pendente (já foi concluído ou removido)'}
      </div>
    </div>
  )
}
