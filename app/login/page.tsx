import LoginForm from './LoginForm'
import { IconBolt } from '@tabler/icons-react'
import Link from 'next/link'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; redirect?: string }>
}) {
  const { error, message, redirect } = await searchParams

  return (
    <div className="neon-theme min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[var(--color-neon)] opacity-15 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[var(--color-neon-deep)] opacity-15 blur-3xl" />

      <div className="relative w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-11 w-11 rounded-lg grid place-items-center neon-glow bg-[var(--color-bg-3)]">
            <IconBolt size={24} className="text-[var(--color-neon-soft)]" stroke={2.2} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-2xl font-black tracking-tighter text-white">
              LIBERTY<span className="neon-text">CAR</span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--color-text-lo)] mt-0.5">
              Painel Interno
            </span>
          </div>
        </Link>

        <div className="rounded-2xl border border-[var(--color-line)] glass-strong p-7">
          <LoginForm error={error} message={message} redirect={redirect} />
        </div>

        <p className="text-center text-[11px] text-[var(--color-text-mute)] mt-6">
          Acesso restrito a colaboradores autorizados Liberty Car.
        </p>
      </div>
    </div>
  )
}
