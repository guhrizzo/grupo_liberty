'use client'

import { useEffect, useState } from 'react'
import FloatingLines, { type FloatingLinesProps } from './floating'

type Props = FloatingLinesProps & {
  /** Se true, desativa em telas < 768px (consome GPU sem necessidade em mobile). */
  disableOnMobile?: boolean
}

/**
 * Wrapper seguro de FloatingLines:
 * - Respeita `prefers-reduced-motion: reduce` (não renderiza nada).
 * - Opcionalmente desativa em mobile (largura < 768px).
 *
 * Inicializa como `false` para evitar mismatch de hidratação: o componente
 * só é montado no client via `useEffect`.
 */
export default function FloatingLinesSafe({
  disableOnMobile = true,
  animationSpeed = 0.6,
  parallax = true,
  interactive = true,
  ...rest
}: Props) {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isMobile = disableOnMobile && window.innerWidth < 768
    setAllowed(!reducedMotion && !isMobile)
  }, [disableOnMobile])

  if (!allowed) return null

  return (
    <FloatingLines
      animationSpeed={animationSpeed}
      parallax={parallax}
      interactive={interactive}
      {...rest}
    />
  )
}
