import Link from 'next/link'
import { IconCalendarCheck, IconAlertTriangle } from '@tabler/icons-react'

export const metadata = {
  title: 'Google Agenda | Liberty Car',
  robots: { index: false },
}

// Página pública de retorno da conexão com o Google Agenda. Pública porque no
// app desktop o retorno abre no navegador do sistema, que pode não ter sessão.
export default async function GoogleAgendaConectadoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; motivo?: string }>
}) {
  const { status, motivo } = await searchParams
  const ok = status === 'ok'

  return (
    <main className="min-h-screen grid place-items-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div
          className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl ${
            ok ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}
        >
          {ok ? <IconCalendarCheck size={28} stroke={2} /> : <IconAlertTriangle size={28} stroke={2} />}
        </div>
        <h1 className="text-xl font-bold text-neutral-950">
          {ok ? 'Google Agenda conectado' : 'Não foi possível conectar'}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          {ok
            ? 'Os compromissos em que você é participante vão aparecer na sua agenda do Google. Se você estava no app Liberty Car, pode fechar esta aba e voltar para ele.'
            : motivo || 'Tente conectar de novo pela aba Agenda.'}
        </p>
        <Link
          href="/dashboard/agenda"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-liberty px-4 py-2.5 text-sm font-bold text-white hover:bg-liberty-deep transition-colors"
        >
          Ir para a Agenda
        </Link>
      </div>
    </main>
  )
}
