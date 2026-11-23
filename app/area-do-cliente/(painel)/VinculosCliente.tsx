import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { IconCar, IconFileDescription } from '@tabler/icons-react'
import { carregarPainelCliente } from '@/utils/portal/painel'

const secoes = {
  veiculos: {
    titulo: 'Meus veículos',
    descricao: 'Consulte os veículos vinculados às suas operações com a Liberty.',
    vazio: 'Nenhum veículo vinculado ao seu cadastro.',
    Icone: IconCar,
  },
  registros: {
    titulo: 'Contratos e operações',
    descricao: 'Consulte os contratos e as operações financeiras vinculados ao seu cadastro.',
    vazio: 'Nenhum contrato ou operação vinculado ao seu cadastro.',
    Icone: IconFileDescription,
  },
}

export default async function VinculosCliente({ secao }: { secao: keyof typeof secoes }) {
  const painel = await carregarPainelCliente({ incluirFotos: secao === 'veiculos' })
  if (!painel) redirect('/area-do-cliente/entrar')

  const { titulo, descricao, vazio, Icone } = secoes[secao]
  const veiculos = new Map(painel.veiculos.map(({ id, nome }) => [id, nome]))
  const itens = secao === 'veiculos'
    ? painel.veiculos.map(({ id, nome, foto }) => ({ id, titulo: nome, detalhe: '', foto }))
    : painel.registros.map(({ id, titulo, detalhe, veiculo, veiculoId }) => ({
      id,
      titulo,
      foto: null,
      detalhe: [detalhe, veiculo || veiculos.get(veiculoId)].filter(Boolean).join(' · '),
    }))

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-5 py-9 sm:px-8 sm:py-14">
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{titulo}</h1>
        <p className="mt-2 text-[var(--portal-secundario)]">{descricao}</p>
      </header>

      {itens.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {itens.map(({ id, titulo, detalhe, foto }) => (
            <li key={id} className="min-w-0 overflow-hidden rounded-2xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)]">
              {secao === 'veiculos' && (
                <div className="relative grid aspect-video place-items-center bg-[var(--portal-lateral)] text-[var(--portal-secundario)]">
                  {foto ? (
                    <Image src={foto} alt={titulo} fill unoptimized referrerPolicy="no-referrer" className="object-contain" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-sm">
                      <IconCar size={28} aria-hidden />
                      <span>Foto indisponível</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex min-w-0 items-start gap-4 p-5">
                {secao === 'registros' && <Icone size={22} aria-hidden className="shrink-0 text-[var(--portal-link)]" />}
                <div className="min-w-0 break-words">
                  <h2 className="font-semibold">{titulo}</h2>
                  {detalhe && <p className="mt-1 text-sm text-[var(--portal-secundario)]">{detalhe}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)] p-6">
          <p className="font-semibold">{vazio}</p>
          <p className="mt-2 text-sm text-[var(--portal-secundario)]">Confira seu CPF ou CNPJ em Meu perfil. Se estiver correto e você esperava encontrar um registro aqui, fale com a equipe Liberty.</p>
          <Link href="/area-do-cliente/perfil" className="mt-4 inline-flex rounded text-sm font-semibold text-[var(--portal-link)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--portal-foco)]">
            Conferir meu perfil
          </Link>
        </div>
      )}
    </main>
  )
}
