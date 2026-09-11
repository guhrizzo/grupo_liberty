'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// Navegação interna do painel não é "visita ao site".
const IGNORAR = ['/dashboard', '/login', '/entrar-dispositivo']

/**
 * Registra uma visita a cada mudança de rota pública, chamando `/api/track`.
 * Não renderiza nada e nunca interfere na navegação (erros são engolidos).
 */
export default function Analytics() {
  const pathname = usePathname()
  const ultimoEnviado = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return
    if (IGNORAR.some((p) => pathname === p || pathname.startsWith(p + '/'))) return
    if (ultimoEnviado.current === pathname) return
    ultimoEnviado.current = pathname

    try {
      fetch('/api/track', {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: pathname }),
      }).catch(() => {})
    } catch {
      /* nunca quebra a navegação */
    }
  }, [pathname])

  return null
}
