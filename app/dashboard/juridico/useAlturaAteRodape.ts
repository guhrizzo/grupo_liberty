'use client'

import { useEffect, useState } from 'react'

const ALTURA_MINIMA = 240
const FOLGA = 12

/** Elemento que rola a página: a tela cheia (overlay fixo) ou a janela. */
function rolador(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY, position } = getComputedStyle(p)
    if (position === 'fixed' && /(auto|scroll)/.test(overflowY)) return p
  }
  return null
}

/**
 * Altura máxima para a caixa da tabela caber inteira na tela, sem rolar a
 * página: do topo da caixa (com a página no início) até o rodapé fixo.
 * Recalcula quando a janela, o rodapé ou o que está acima da caixa mudam.
 */
export function useAlturaAteRodape(
  caixa: HTMLElement | null,
  rodape: HTMLElement | null,
): number | null {
  const [altura, setAltura] = useState<number | null>(null)

  useEffect(() => {
    if (!caixa) return
    const pai = rolador(caixa)
    const calcular = () => {
      const rolagem = pai ? pai.scrollTop : window.scrollY
      const topoTela = pai ? pai.getBoundingClientRect().top : 0
      const alturaTela = pai ? pai.clientHeight : window.innerHeight
      const paddingBaixo = pai ? parseFloat(getComputedStyle(pai).paddingBottom) || 0 : 0
      const topo = caixa.getBoundingClientRect().top - topoTela + rolagem
      const h = alturaTela - topo - (rodape?.offsetHeight ?? 0) - paddingBaixo - FOLGA
      setAltura(Math.max(ALTURA_MINIMA, Math.floor(h)))
    }
    calcular()
    const ro = new ResizeObserver(calcular)
    // O que está acima da caixa (barra de seleção, avisos de filtro) muda o
    // tamanho da seção; o rodapé muda com a paginação/barra horizontal.
    if (caixa.parentElement) ro.observe(caixa.parentElement)
    if (rodape) ro.observe(rodape)
    window.addEventListener('resize', calcular)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', calcular)
    }
  }, [caixa, rodape])

  return altura
}
