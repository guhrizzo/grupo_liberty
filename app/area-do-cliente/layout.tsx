import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Área do Cliente | Liberty',
  robots: { index: false, follow: false },
}

export default function LayoutPortal({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0b1423] text-white">
      {children}
    </div>
  )
}
