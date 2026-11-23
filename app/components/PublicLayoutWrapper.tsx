'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import PublicFooter from './PublicFooter'
import PreloaderPublico from './PreloaderPublico'
import RolagemPublica from './RolagemPublica'

/**
 * Mostra o footer público em rotas que NÃO sejam internas (dashboard/login/api).
 * O `not-found.tsx` é full-screen centralizado e já não usa o footer.
 */
export default function PublicLayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const isPrivate =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/login') ||
    pathname === '/entrar' ||
    pathname.startsWith('/area-do-cliente') ||
    pathname.startsWith('/api')

  if (isPrivate) return <>{children}</>

  if (pathname === '/') {
    return (
      <>
        <PreloaderPublico />
        <RolagemPublica>
          <div className="flex-1">{children}</div>
          <PublicFooter />
        </RolagemPublica>
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PreloaderPublico />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  )
}
