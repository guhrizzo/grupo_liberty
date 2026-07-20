'use client'

export default function LoadingBar({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={`relative w-full overflow-hidden rounded-full bg-neutral-200 ${className}`}
    >
      <div className="absolute inset-y-0 w-1/3 animate-loading-bar rounded-full bg-gradient-to-r from-transparent via-neutral-500 to-transparent shadow-[0_0_12px_2px_rgba(115,115,115,0.45)]" />
      <span className="sr-only">Carregando…</span>
    </div>
  )
}
