'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Barra de rolagem horizontal ligada a outro elemento (a caixa da tabela).
 * Fica no rodapé fixo da tela, então dá para rolar as colunas sem descer até
 * o fim da tabela. A caixa da tabela esconde a própria barra horizontal
 * (overflow-x-hidden); a rolagem por trackpad/Shift+roda é repassada aqui.
 */
export default function BarraRolagemHorizontal({ alvo }: { alvo: HTMLElement | null }) {
  const barraRef = useRef<HTMLDivElement | null>(null)
  const [temBarra, setTemBarra] = useState(false)
  const refBarra = useCallback((el: HTMLDivElement | null) => {
    barraRef.current = el
    setTemBarra(!!el)
  }, [])
  const [larguras, setLarguras] = useState({ conteudo: 0, visivel: 0 })

  // Mede a tabela e repassa a rolagem horizontal do trackpad/Shift+roda.
  useEffect(() => {
    if (!alvo) return
    const medir = () => setLarguras({ conteudo: alvo.scrollWidth, visivel: alvo.clientWidth })
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(alvo)
    if (alvo.firstElementChild) ro.observe(alvo.firstElementChild)
    const onWheel = (e: WheelEvent) => {
      const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0)
      if (!dx) return
      alvo.scrollLeft += dx
      e.preventDefault()
    }
    alvo.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      ro.disconnect()
      alvo.removeEventListener('wheel', onWheel)
    }
  }, [alvo])

  // Mantém barra e tabela na mesma posição, nos dois sentidos.
  useEffect(() => {
    const barra = barraRef.current
    if (!alvo || !barra || !temBarra) return
    barra.scrollLeft = alvo.scrollLeft
    const daTabela = () => {
      if (barra.scrollLeft !== alvo.scrollLeft) barra.scrollLeft = alvo.scrollLeft
    }
    const daBarra = () => {
      if (alvo.scrollLeft !== barra.scrollLeft) alvo.scrollLeft = barra.scrollLeft
    }
    alvo.addEventListener('scroll', daTabela, { passive: true })
    barra.addEventListener('scroll', daBarra, { passive: true })
    return () => {
      alvo.removeEventListener('scroll', daTabela)
      barra.removeEventListener('scroll', daBarra)
    }
  }, [alvo, temBarra])

  if (!alvo || larguras.conteudo <= larguras.visivel + 1) return null

  // Mesma borda da caixa da tabela: as larguras internas batem e a barra anda
  // 1:1 com as colunas.
  return (
    <div
      ref={refBarra}
      aria-hidden
      className="overflow-x-auto overflow-y-hidden rounded-lg border border-neutral-200 bg-white"
    >
      <div style={{ width: larguras.conteudo, height: 1 }} />
    </div>
  )
}
