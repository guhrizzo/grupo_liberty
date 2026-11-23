import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { IconArrowRight, IconBuildingBank, IconCar, IconFileDescription, IconLifebuoy, IconReceipt } from '@tabler/icons-react'
import { carregarPainelCliente } from '@/utils/portal/painel'
import { modulosPortal } from '@/utils/portal/modelo'

const linksModulos = {
  quitacao: { href: '/area-do-cliente/quitacao', acao: 'Acompanhar quitação', Icone: IconReceipt },
  posVenda: { href: '/area-do-cliente/pos-venda', acao: 'Ver serviços', Icone: IconLifebuoy },
  investimentos: { href: '/area-do-cliente/investimentos', acao: 'Ver investimentos', Icone: IconBuildingBank },
}

const cartaoResumo = 'flex min-w-0 scroll-mt-16 flex-col rounded-2xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)] p-5 sm:p-6'
const iconeResumo = 'grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--portal-link)_12%,transparent)] text-[var(--portal-link)]'
const linkResumo = 'group mt-5 flex min-h-11 items-center justify-between gap-3 rounded-sm border-t border-[var(--portal-divisor)] pt-2 text-sm font-semibold text-[var(--portal-link)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--portal-foco)]'

export default async function PainelClientePage() {
  const painel = await carregarPainelCliente({ incluirFotos: true })
  if (!painel) redirect('/area-do-cliente/entrar')
  const modulos = modulosPortal.filter(({ id }) => painel.modulos.includes(id))

  return (
    <main id="inicio-portal" className="mx-auto max-w-6xl scroll-mt-16 space-y-9 px-5 py-9 sm:px-8 sm:py-14">
      <div>
        <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">Olá, {painel.nome}</h1>
        <p className="mt-2 text-[var(--portal-secundario)]">Veja o que está vinculado ao seu cadastro Liberty.</p>
      </div>

      {modulos.length > 0 && (
        <section aria-labelledby="modulos-portal">
          <h2 id="modulos-portal" className="mb-4 text-xl font-semibold">Seus módulos</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modulos.map(({ id, nome, descricao }) => {
              const { href, acao, Icone } = linksModulos[id]

              return (
                <li key={id} id={`modulo-${id}`} className="min-w-0 scroll-mt-16">
                  <Link
                    href={href}
                    aria-labelledby={`modulo-${id}-titulo modulo-${id}-acao`}
                    className="group flex h-full cursor-pointer flex-col rounded-2xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)] p-5 transition-colors hover:border-[var(--portal-link)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--portal-foco)] motion-reduce:transition-none"
                  >
                    <span className="mb-4 grid size-11 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--portal-link)_12%,transparent)] text-[var(--portal-link)]">
                      <Icone aria-hidden size={22} stroke={1.7} />
                    </span>
                    <h3 id={`modulo-${id}-titulo`} className="text-lg leading-tight font-semibold">{nome}</h3>
                    <p className="mt-2 mb-5 flex-1 text-sm leading-relaxed text-[var(--portal-secundario)]">{descricao}</p>
                    <span className="flex items-center justify-between gap-2 border-t border-[var(--portal-divisor)] pt-3 text-sm font-semibold text-[var(--portal-link)]">
                      <span id={`modulo-${id}-acao`}>{acao}</span>
                      <IconArrowRight aria-hidden size={18} className="shrink-0 motion-safe:transition-transform motion-safe:group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section id="veiculos-portal" className={cartaoResumo} aria-labelledby="titulo-veiculos-portal">
          <h2 id="titulo-veiculos-portal" className="flex items-center gap-3 text-lg font-semibold"><span className={iconeResumo}><IconCar aria-hidden size={21} /></span> Seus veículos</h2>
          {painel.veiculos.length > 0 ? (
            <ul className="mt-4 flex-1 divide-y divide-[var(--portal-divisor)]">
              {painel.veiculos.slice(0, 3).map(({ id, nome, foto }) => (
                <li key={id} className="flex min-h-16 items-center gap-3 py-2">
                  <span className="relative grid h-12 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--portal-fundo)] text-[var(--portal-secundario)]">
                    {foto ? <Image src={foto} alt="" fill unoptimized sizes="80px" referrerPolicy="no-referrer" className="object-contain" /> : <IconCar aria-hidden size={22} />}
                  </span>
                  <span className="min-w-0 break-words text-sm font-semibold">{nome}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 flex-1 text-sm text-[var(--portal-secundario)]">Nenhum veículo vinculado ao seu cadastro.</p>}
          <Link href="/area-do-cliente/veiculos" className={linkResumo}>Ver meus veículos <IconArrowRight aria-hidden size={18} className="shrink-0 motion-safe:transition-transform motion-safe:group-hover:translate-x-1" /></Link>
        </section>
        <section id="registros-portal" className={cartaoResumo} aria-labelledby="titulo-registros-portal">
          <h2 id="titulo-registros-portal" className="flex items-center gap-3 text-lg font-semibold"><span className={iconeResumo}><IconFileDescription aria-hidden size={21} /></span> Contratos e operações</h2>
          {painel.registros.length > 0 ? (
            <ul className="mt-4 flex-1 divide-y divide-[var(--portal-divisor)]">
              {painel.registros.slice(0, 3).map(({ id, titulo, detalhe, veiculo, veiculoId }) => (
                <li key={id} className="flex min-h-16 flex-col justify-center break-words py-2">
                  <h3 className="text-sm font-semibold">{titulo}</h3>
                  <p className="mt-1 text-sm text-[var(--portal-secundario)]">{[detalhe, veiculo || painel.veiculos.find(({ id }) => id === veiculoId)?.nome].filter(Boolean).join(' · ')}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 flex-1 text-sm text-[var(--portal-secundario)]">Nenhum contrato ou operação vinculado ao seu cadastro.</p>}
          <Link href="/area-do-cliente/contratos-e-operacoes" className={linkResumo}>Ver contratos e operações <IconArrowRight aria-hidden size={18} className="shrink-0 motion-safe:transition-transform motion-safe:group-hover:translate-x-1" /></Link>
        </section>
      </div>
    </main>
  )
}
