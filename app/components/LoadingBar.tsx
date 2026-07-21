'use client'

export default function LoadingBar({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={`relative w-full overflow-hidden rounded-full bg-bg-3 ${className}`}
    >
      <div className="absolute inset-y-0 w-1/3 animate-loading-bar rounded-full bg-linear-to-r from-transparent via-neon to-transparent shadow-[0_0_14px_2px_rgba(0,212,255,0.55)]" />
      <span className="sr-only">Carregando…</span>
    </div>
  )
}
