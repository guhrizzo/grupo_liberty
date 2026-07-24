import { cn } from '@/utils/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-md bg-neutral-200/80 neon-theme:bg-[var(--color-bg-3)] animate-pulse',
        className,
      )}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
      <Skeleton className="aspect-video w-full mb-3" />
      <Skeleton className="h-4 w-2/3 mb-2" />
      <Skeleton className="h-3 w-1/2 mb-3" />
      <div className="flex gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  )
}

export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-3 w-full" />
        </td>
      ))}
    </tr>
  )
}
