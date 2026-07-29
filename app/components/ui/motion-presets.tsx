'use client'

import { HTMLMotionProps, motion, type Variants } from 'motion/react'
import { type ReactNode } from 'react'

/**
 * Presets de animação baseados em `motion` (https://motion.dev).
 *
 * Mantemos as durações/curvas já usadas nos keyframes do projeto para
 * preservar a "identidade" visual (cubic-bezier(0.16, 1, 0.3, 1)).
 * Todos os presets respeitam `prefers-reduced-motion: reduce` via
 * `MotionConfig` no root do app.
 */

const EASE = [0.16, 1, 0.3, 1] as const

export const motionEasing = EASE

/** Variants: fade-in simples. */
export const fadeInVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: EASE } },
}

/** Variants: zoom-in 95% (substitui `animate-zoom-in-95`). */
export const zoomInVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.18, ease: EASE } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15, ease: EASE } },
}

/** Variants: fade-up (cards/listas entrando). */
export const fadeUpVariants: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: EASE } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.2, ease: EASE } },
}

/** Variants: slide-in-right (toasts). */
export const slideInRightVariants: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: EASE } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.2, ease: EASE } },
}

/** Variants: slide-in-left. */
export const slideInLeftVariants: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: EASE } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: EASE } },
}

/**
 * Container para listas com stagger suave nos filhos.
 * Use com `motionStaggerItem` em cada item.
 */
export const motionStaggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
}

export const motionStaggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
}

/* ===================== Wrappers prontos ===================== */

interface MotionFadeProps extends Omit<HTMLMotionProps<'div'>, 'variants' | 'initial' | 'animate' | 'exit'> {
  children: ReactNode
}

export function FadeIn({ children, ...rest }: MotionFadeProps) {
  return (
    <motion.div
      variants={fadeInVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      {...rest}
    >
      {children}
    </motion.div>
  )
}

export function ZoomIn({ children, ...rest }: MotionFadeProps) {
  return (
    <motion.div
      variants={zoomInVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      {...rest}
    >
      {children}
    </motion.div>
  )
}

export function FadeUp({ children, ...rest }: MotionFadeProps) {
  return (
    <motion.div
      variants={fadeUpVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      {...rest}
    >
      {children}
    </motion.div>
  )
}

export function SlideInRight({ children, ...rest }: MotionFadeProps) {
  return (
    <motion.div
      variants={slideInRightVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      {...rest}
    >
      {children}
    </motion.div>
  )
}
