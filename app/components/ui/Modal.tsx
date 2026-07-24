'use client'

import { useEffect, useRef, ReactNode, useId } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from '@tabler/icons-react'
import { cn } from '@/utils/cn'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  /** Conteúdo do modal. */
  children: ReactNode
  /** Largura máxima. */
  size?: 'sm' | 'md' | 'lg'
  /** Esconde o botão X (Escape ainda fecha). */
  hideClose?: boolean
  className?: string
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  hideClose = false,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  const prevFocus = useRef<HTMLElement | null>(null)

  // Body scroll lock
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Escape para fechar + foco inicial + restore
  useEffect(() => {
    if (!open) return
    prevFocus.current = document.activeElement as HTMLElement | null

    const dialog = dialogRef.current
    if (dialog) {
      const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE)
      const first = focusables[0]
      if (first) {
        // timeout para o React montar
        setTimeout(() => first.focus(), 0)
      } else {
        dialog.focus()
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && dialog) {
        const focusables = Array.from(
          dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
        )
        if (focusables.length === 0) {
          e.preventDefault()
          dialog.focus()
          return
        }
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      // Restaura foco no elemento que abriu o modal.
      prevFocus.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 backdrop-blur-sm p-4 animate-fade-in"
      onMouseDown={(e) => {
        // fecha só se o clique começou no backdrop
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'w-full rounded-xl border border-neutral-200 bg-white p-6 shadow-2xl animate-zoom-in-95 neon-theme:border-[var(--color-line)] neon-theme:bg-[var(--color-bg-1)]',
          sizeMap[size],
          className,
        )}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1 min-w-0">
              {title && (
                <h2
                  id={titleId}
                  className="text-lg font-bold text-neutral-950 neon-theme:text-white"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-1 text-sm text-neutral-600 neon-theme:text-text-md">
                  {description}
                </p>
              )}
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors cursor-pointer neon-theme:text-text-lo neon-theme:hover:bg-[var(--color-bg-3)] neon-theme:hover:text-white"
              >
                <IconX size={18} stroke={2} />
              </button>
            )}
          </div>
        )}
        <div>{children}</div>
      </div>
    </div>,
    document.body,
  )
}
