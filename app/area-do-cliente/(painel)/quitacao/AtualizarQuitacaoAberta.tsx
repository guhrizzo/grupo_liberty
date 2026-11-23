'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AtualizarQuitacaoAberta() {
  const router = useRouter()

  useEffect(() => {
    function atualizar() {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const timer = window.setInterval(atualizar, 60_000)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [router])

  return null
}
