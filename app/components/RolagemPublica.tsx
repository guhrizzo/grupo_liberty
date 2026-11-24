'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollSmoother } from 'gsap/dist/ScrollSmoother'
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger'
import PublicHeader from './PublicHeader'

export default function RolagemPublica({ children }: { children: ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null)
  const cabecalho = useRef<HTMLDivElement>(null)
  const janela = useRef<HTMLDivElement>(null)
  const conteudo = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const container = raiz.current
    const topo = cabecalho.current
    const wrapper = janela.current
    const content = conteudo.current
    if (!container || !topo || !wrapper || !content) return

    gsap.registerPlugin(ScrollTrigger, ScrollSmoother)
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)', () => {
      const ajustarTopo = () => {
        const altura = `${topo.offsetHeight}px`
        container.style.setProperty('--altura-cabecalho', altura)
      }
      ajustarTopo()
      container.dataset.rolagemSuave = 'true'
      const suavizador = ScrollSmoother.create({
        wrapper,
        content,
        smooth: 0.8,
        smoothTouch: 0,
        onFocusIn: (_smoother, evento) => !(evento.target instanceof HTMLElement && evento.target.matches('section[tabindex="-1"]')),
      })
      const irParaSecao = (hash: string, animar: boolean) => {
        const destino = document.getElementById(hash.slice(1))
        if (!destino || !content.contains(destino)) return false
        const margem = Number.parseFloat(getComputedStyle(destino).scrollMarginTop) || topo.offsetHeight
        const posicao = gsap.utils.clamp(0, ScrollTrigger.maxScroll(window), suavizador.offset(destino, 'top top') - margem)
        // Rolagem nativa: o navegador anima sem JS por quadro e o ScrollSmoother apenas acompanha.
        window.scrollTo({ top: posicao, behavior: animar ? 'smooth' : 'auto' })
        return true
      }
      const clicarAncora = (evento: MouseEvent) => {
        if (evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return
        const link = evento.target instanceof Element ? evento.target.closest<HTMLAnchorElement>('a[href^="#"]') : null
        if (!link?.hash || !irParaSecao(link.hash, true)) return
        evento.preventDefault()
        if (location.hash !== link.hash) history.pushState(null, '', link.hash)
        document.getElementById(link.hash.slice(1))?.focus({ preventScroll: true })
      }
      const sincronizarAncora = () => irParaSecao(location.hash, false)
      const frame = requestAnimationFrame(sincronizarAncora)
      content.addEventListener('click', clicarAncora)
      window.addEventListener('hashchange', sincronizarAncora)
      const observer = new ResizeObserver(ajustarTopo)
      observer.observe(topo)

      return () => {
        observer.disconnect()
        cancelAnimationFrame(frame)
        content.removeEventListener('click', clicarAncora)
        window.removeEventListener('hashchange', sincronizarAncora)
        suavizador.kill()
        delete container.dataset.rolagemSuave
        container.style.removeProperty('--altura-cabecalho')
      }
    })

    return () => media.revert()
  }, [])

  return (
    <div ref={raiz} className="group/rolagem flex min-h-screen flex-col">
      <div ref={cabecalho} className="sticky top-0 z-40 group-data-[rolagem-suave=true]/rolagem:fixed group-data-[rolagem-suave=true]/rolagem:inset-x-0"><PublicHeader /></div>
      <div ref={janela} className="flex flex-1 flex-col">
        <div ref={conteudo} className="flex flex-1 flex-col group-data-[rolagem-suave=true]/rolagem:pt-[var(--altura-cabecalho)]">{children}</div>
      </div>
    </div>
  )
}
