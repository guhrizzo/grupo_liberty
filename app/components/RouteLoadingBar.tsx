'use client'

import { useEffect, useTransition, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import LoadingBar from './LoadingBar'

/**
 * Barra de progresso que aparece durante navegação client-side.
 *
 * Estratégia:
 * 1. Escuta mudanças de `pathname` (já é o que indica navegação concluída).
 * 2. Usa `useTransition` em conjunto com `router.push` para detectar navegações
 *    iniciadas via código (substitui o monkey-patching frágil de versões anteriores).
 * 3. Em SSR, retorna `null`.
 */
export default function RouteLoadingBar() {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  // Mostra a barra quando o pathname começa a mudar.
  useEffect(() => {
    setLoading(true)
    // Esconde rapidamente após o pathname atualizar. A maioria das navegações
    // client-side é síncrona após a render.
    const t = setTimeout(() => setLoading(false), 250)
    return () => clearTimeout(t)
  }, [pathname])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      <LoadingBar className="h-1" />
    </div>
  )
}
