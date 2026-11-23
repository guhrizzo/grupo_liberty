import { redirect } from 'next/navigation'
import { clienteAutenticado } from '@/utils/portal/acesso'
import { lerTemaPortal } from '@/utils/portal/tema'
import NavegacaoCliente from '../NavegacaoCliente'

export default async function LayoutPainelCliente({ children }: { children: React.ReactNode }) {
  const cliente = await clienteAutenticado()
  if (!cliente) redirect('/area-do-cliente/entrar')

  return (
    <NavegacaoCliente
      nome={cliente.nome}
      email={cliente.cadastro.email}
      foto={cliente.foto}
      ordemInicial={cliente.cadastro.ordemMenu ?? []}
      temaInicial={await lerTemaPortal()}
      modulos={cliente.cadastro.modulos}
    >
      {children}
    </NavegacaoCliente>
  )
}
