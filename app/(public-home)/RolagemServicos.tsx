'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger'

export default function RolagemServicos({ children }: { children: ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = raiz.current
    if (!container) return
    gsap.registerPlugin(ScrollTrigger)
    const media = gsap.matchMedia(container)

    media.add('(prefers-reduced-motion: no-preference)', () => {
      for (const secao of container.querySelectorAll<HTMLElement>('[data-servico-scroll]')) {
        const detalhes = secao.querySelectorAll('[data-servico-detalhe]')
        if (detalhes.length) {
          gsap.fromTo(detalhes, { y: 30 }, {
            y: 0, ease: 'none', stagger: 0.12,
            scrollTrigger: { trigger: secao, start: 'top 96%', end: 'top 42%', scrub: 0.6 },
          })
        }

        const visual = secao.querySelector('[data-servico-visual]')
        if (visual?.parentElement) {
          gsap.fromTo(visual, { yPercent: -4 }, {
            yPercent: 4,
            ease: 'none',
            scrollTrigger: { trigger: visual.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
          })
        }
      }
    })

    media.add({ ativo: '(prefers-reduced-motion: no-preference)', largo: '(min-width: 1024px)' }, ({ conditions }) => {
      const grade = container.querySelector('[data-planos-scroll]')
      if (!conditions?.ativo || !grade) return

      const planos = [...grade.querySelectorAll('[data-plano-scroll]')]
      if (conditions.largo) {
        gsap.fromTo(planos, { y: 44, opacity: 0 }, {
          y: 0, opacity: 1, ease: 'power3.out', duration: 0.7, stagger: 0.23,
          scrollTrigger: { trigger: grade, start: 'top 96%', end: 'top 42%', scrub: 0.55 },
        })
        return
      }

      planos.forEach((plano, indice) => {
        const inicio = 96 - (indice % 2) * 9
        gsap.fromTo(plano, { y: 30, opacity: 0 }, {
          y: 0, opacity: 1, ease: 'power3.out',
          scrollTrigger: { trigger: plano, start: `top ${inicio}%`, end: `top ${inicio - 28}%`, scrub: 0.5 },
        })
      })
    })

    return () => media.revert()
  }, [])

  return <div ref={raiz}>{children}</div>
}
