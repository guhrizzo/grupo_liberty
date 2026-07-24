import Link from 'next/link'
import { IconChevronRight } from '@tabler/icons-react'
import { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export function Breadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[]
  className?: string
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-2 text-sm text-neutral-500', className)}>
      <ol className="flex items-center gap-2 flex-wrap">
        {items.map((it, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${it.label}-${i}`} className="flex items-center gap-2">
              {it.href && !last ? (
                <Link
                  href={it.href}
                  className="hover:text-neutral-900 hover:underline transition-colors"
                >
                  {it.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    'font-medium',
                    last ? 'text-neutral-900' : 'text-neutral-500',
                  )}
                  aria-current={last ? 'page' : undefined}
                >
                  {it.label}
                </span>
              )}
              {!last && (
                <IconChevronRight
                  size={12}
                  stroke={2}
                  className="text-neutral-400"
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
