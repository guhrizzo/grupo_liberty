import type { Metadata } from 'next'
import { IconCar, IconDeviceDesktop, IconAlertTriangle } from '@tabler/icons-react'
import { getSessionUser } from '@/utils/permissions'
import LoginForm from '@/app/login/LoginForm'
import ConsentimentoDispositivo from './ConsentimentoDispositivo'

export const metadata: Metadata = {
  title: 'Entrar no app | Liberty Car',
  robots: { index: false, follow: false },
}

function parseParams(sp: Record<string, string | string[] | undefined>) {
  const porta = Number(Array.isArray(sp.porta) ? sp.porta[0] : sp.porta)
  const state = (Array.isArray(sp.state) ? sp.state[0] : sp.state) ?? ''
  const portaOk = Number.isInteger(porta) && porta >= 1024 && porta <= 65535
  const stateOk = /^[A-Za-z0-9]{8,64}$/.test(state)
  return portaOk && stateOk ? { porta, state } : null
}

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden bg-linear-to-br from-liberty/5 via-white to-neutral-50">
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-liberty/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-liberty-soft/10 blur-3xl pointer-events-none" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="h-11 w-11 rounded-lg grid place-items-center bg-liberty/10 liberty-glow">
            <IconCar size={24} className="text-liberty" stroke={2.2} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-2xl font-black tracking-tighter text-neutral-900">
              LIBERTY<span className="text-liberty">CAR</span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 mt-0.5">
              Painel Interno
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-7 shadow-lg shadow-liberty/5">
          {children}
        </div>
      </div>
    </div>
  )
}

export default async function EntrarDispositivoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = parseParams(await searchParams)

  if (!params) {
    return (
      <Casca>
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <IconAlertTriangle size={24} />
          </div>
          <h1 className="text-lg font-bold text-neutral-900">Abra pelo app Liberty Car</h1>
          <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
            Esta página é usada pelo aplicativo de desktop para concluir o login.
            Abra o app e clique em <strong>&ldquo;Entrar com o navegador&rdquo;</strong>.
          </p>
        </div>
      </Casca>
    )
  }

  const user = await getSessionUser()

  if (!user) {
    return (
      <Casca>
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-liberty/20 bg-liberty/5 px-3 py-2 text-xs font-semibold text-liberty-deep">
          <IconDeviceDesktop size={15} />
          Faça login para entrar no app de desktop
        </div>
        <LoginForm
          redirect={`/entrar-dispositivo?porta=${params.porta}&state=${params.state}`}
        />
      </Casca>
    )
  }

  return (
    <Casca>
      <ConsentimentoDispositivo
        porta={params.porta}
        state={params.state}
        email={user.email ?? ''}
      />
    </Casca>
  )
}
