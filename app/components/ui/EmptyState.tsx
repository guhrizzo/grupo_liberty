import { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
  /** Tamanho: padrão 'md', 'sm' para uso em células de tabela. */
  size?: 'sm' | 'md' | 'lg'
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  const padding = size === 'sm' ? 'p-8' : size === 'lg' ? 'p-16' : 'p-12'
  const iconWrap = size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-16 w-16' : 'h-12 w-12'
  const iconSize = size === 'sm' ? 20 : size === 'lg' ? 32 : 24

  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-neutral-200 neon-theme:border-[var(--color-line)] bg-white neon-theme:bg-[var(--color-bg-1)] text-center',
        padding,
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            'mx-auto mb-3 rounded-full bg-neutral-100 neon-theme:bg-[var(--color-bg-2)] flex items-center justify-center text-neutral-400 neon-theme:text-text-lo',
            iconWrap,
          )}
          style={{ width: iconWrap.split(' ').find(c => c.startsWith('w-')), height: iconWrap.split(' ').find(c => c.startsWith('h-')) }}
        >
          {/* Quando o ícone já tem size próprio, o wrapper só centraliza. */}
          <div style={{ fontSize: iconSize }}>{icon}</div>
        </div>
      )}
      <h3 className="text-sm font-bold text-neutral-900 neon-theme:text-white">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-neutral-500 neon-theme:text-text-lo">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
