'use client'

import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Configura o `motion` globalmente:
 * - Reduz todas as animações quando `prefers-reduced-motion: reduce`.
 * - Define a curva padrão do projeto.
 */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionConfig>
  )
}
