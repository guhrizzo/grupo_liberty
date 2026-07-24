'use client'

import { ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' usa botão rose. 'primary' usa o botão liberty. */
  tone?: 'primary' | 'danger'
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'primary',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {description && (
        <div className="text-sm text-neutral-600 neon-theme:text-text-md mt-2">{description}</div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === 'danger' ? 'danger' : 'liberty'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
