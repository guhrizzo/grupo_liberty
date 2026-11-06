import LoginForm from './LoginForm'
import Image from 'next/image'
import Link from 'next/link'
import LOGO_LIBERTY from '@/app/public/logo-liberty-car-blue.png'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; redirect?: string }>
}) {
  const { message, redirect } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden bg-linear-to-br from-liberty/5 via-white to-neutral-50">
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-liberty/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-liberty-soft/10 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <Link href="/" className="flex flex-col items-center justify-center gap-2 mb-8" aria-label="Liberty Car">
          <Image src={LOGO_LIBERTY} alt="Liberty Car" priority className="h-auto w-44" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500">
            Painel Interno
          </span>
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
