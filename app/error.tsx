'use client'

import { useEffect } from 'react'
import { IconAlertTriangle, IconRefresh, IconHome } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from './components/ui'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
          <IconAlertTriangle size={28} className="text-rose-500" />
        </div>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-rose-500">
            Erro inesperado
          </p>
          <h1 className="mt-1 text-2xl font-black text-neutral-900">Algo deu errado</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Encontramos um problema ao processar sua requisição. Tente novamente em alguns instantes.
          </p>
          {error.digest && (
            <p className="mt-2 text-[10px] text-neutral-400 font-mono">
              Código: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
          <Button variant="liberty" onClick={reset} leftIcon={<IconRefresh size={14} />}>
            Tentar novamente
          </Button>
          <Link href="/">
            <Button variant="secondary" leftIcon={<IconHome size={14} />}>
              Voltar ao início
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
