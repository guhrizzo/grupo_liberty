'use client'

import { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export function Table({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn(
          'w-full border-collapse text-left text-sm text-neutral-600 neon-theme:text-text-md adobe-dark:text-adobe-text-md',
          className,
        )}
      >
        {children}
      </table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-700 border-b border-neutral-200 neon-theme:bg-[var(--color-bg-2)] neon-theme:text-neutral-300 neon-theme:border-[var(--color-line)] adobe-dark:bg-adobe-bg-2 adobe-dark:text-adobe-text-md adobe-dark:border-adobe-line">
      {children}
    </thead>
  )
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-neutral-200 neon-theme:divide-[var(--color-line)] adobe-dark:divide-adobe-line">{children}</tbody>
}

export function TR({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'hover:bg-neutral-50/80 neon-theme:hover:bg-[var(--color-bg-2)]/60 adobe-dark:hover:bg-adobe-bg-3/60 transition-[background-color] duration-200 ease-out',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function TH({
  children,
  align = 'left',
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-3',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  )
}

export function TD({
  children,
  align = 'left',
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'px-4 py-3',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  )
}
