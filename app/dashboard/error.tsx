'use client'

import { useEffect } from 'react'
import { IconAlertTriangle, IconRefresh, IconHome } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '../components/ui'

export default function DashboardError({
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
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
          <IconAlertTriangle size={28} className="text-rose-600" />
        </div>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-rose-600">
            Erro no painel
          </p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-950">Não foi possível carregar</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Ocorreu um problema ao buscar os dados. Tente novamente.
          </p>
          {error.digest && (
            <p className="mt-2 text-[10px] text-neutral-400 font-mono">Código: {error.digest}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="liberty" onClick={reset} leftIcon={<IconRefresh size={14} />}>
            Tentar novamente
          </Button>
          <Link href="/dashboard">
            <Button variant="secondary" leftIcon={<IconHome size={14} />}>
              Início
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
