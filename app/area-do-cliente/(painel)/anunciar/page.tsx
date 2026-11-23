import { redirect } from 'next/navigation'
import AnuncioForm from '@/app/anuncie-seu-veiculo/AnuncioForm'
import { clienteAutenticado } from '@/utils/portal/acesso'

export default async function AnunciarVeiculoPage() {
  const cliente = await clienteAutenticado()
  if (!cliente) redirect('/area-do-cliente/entrar')

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-9 sm:px-8 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Anunciar meu veículo</h1>
        <p className="mt-2 text-[var(--portal-secundario)]">
          Envie os dados e as fotos do veículo para a Liberty avaliar. Nossa equipe entrará em contato pelo telefone ou e-mail informado.
        </p>
      </header>
      <AnuncioForm clientePortal={{ nome: cliente.nome, email: cliente.cadastro.email }} />
    </main>
  )
}
