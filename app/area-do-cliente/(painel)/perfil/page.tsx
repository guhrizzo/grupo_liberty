import { redirect } from 'next/navigation'
import { clienteAutenticado } from '@/utils/portal/acesso'
import FormPerfil from './FormPerfil'

export default async function PerfilClientePage() {
  const cliente = await clienteAutenticado()
  if (!cliente) redirect('/area-do-cliente/entrar')

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-9 sm:px-8 sm:py-14">
      <header className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Meu perfil</h1>
        <p className="mt-2 text-[var(--portal-secundario)]">Consulte seu documento e atualize seus dados de contato.</p>
      </header>
      <FormPerfil perfil={cliente.perfil} documento={cliente.documento} email={cliente.cadastro.email} />
    </main>
  )
}
