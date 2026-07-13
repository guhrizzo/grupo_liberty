import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Bem-vindo
        </h1>
        <p className="mt-2 text-gray-600">
          {user
            ? `Você está logado como ${user.email}`
            : 'Faça login para acessar o painel'}
        </p>

        <div className="mt-6 flex justify-center gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded bg-black px-6 py-2 text-white"
            >
              Ir para o Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded bg-black px-6 py-2 text-white"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}