import { redirect } from 'next/navigation'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import FormCadastroPortal from './FormCadastroPortal'

export default async function ClientesPortalPage() {
  const usuario = await getSessionUser()
  if (!usuario) redirect('/login')
  if (!hasPageAccess(usuario, 'clientes_portal')) redirect('/dashboard/demandas?error=acesso_negado')

  return (
    <main className="mx-auto w-full max-w-6xl p-5 sm:p-8">
      <h1 className="text-2xl font-bold">Clientes do portal</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">
        Busque pelo CPF ou CNPJ para reaproveitar o cadastro existente, confirmar o e-mail e liberar o acesso à Área do Cliente.
      </p>
      <FormCadastroPortal />
    </main>
  )
}
