import LoginForm from './LoginForm'
import { IconBolt } from '@tabler/icons-react'
import Link from 'next/link'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; redirect?: string }>
}) {
  const { message, redirect } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden bg-gradient-to-br from-liberty/5 via-white to-neutral-50">
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-liberty/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-liberty-soft/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-11 w-11 rounded-lg grid place-items-center bg-liberty/10 liberty-glow">
            <IconBolt size={24} className="text-liberty" stroke={2.2} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-2xl font-black tracking-tighter text-neutral-900">
              LIBERTY<span className="text-liberty">CAR</span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 mt-0.5">
              Painel Interno
            </span>
          </div>
        </Link>

        <div className="rounded-2xl border border-neutral-200 bg-white p-7 shadow-lg shadow-liberty/5">
          <LoginForm message={message} redirect={redirect} />
        </div>

        <p className="text-center text-[11px] text-neutral-500 mt-6">
          Acesso restrito a colaboradores autorizados Liberty Car.
        </p>
      </div>
    </div>
  )
}
