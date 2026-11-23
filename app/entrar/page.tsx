import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { IconArrowRight, IconBriefcase, IconUserCircle } from '@tabler/icons-react'
import BotaoTemaPublico from '@/app/components/BotaoTemaPublico'
import logoClaro from '@/app/public/logo-liberty-car-blue.png'
import logoEscuro from '@/app/public/logo-liberty-car-white.png'
import { getSessionUser } from '@/utils/permissions'

export const metadata: Metadata = {
  title: 'Entrar | Grupo Liberty',
  robots: { index: false, follow: false },
}

export default async function EntrarPage() {
  const colaborador = await getSessionUser()
  const opcoes = [
    {
      titulo: 'Área do Cliente',
      descricao: 'Consulte seus veículos, contratos e serviços.',
      href: '/area-do-cliente',
      Icone: IconUserCircle,
    },
    {
      titulo: 'Usuário interno',
      descricao: 'Acesse o sistema interno do Grupo Liberty.',
      href: colaborador ? '/dashboard' : '/login',
      Icone: IconBriefcase,
    },
  ]

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" aria-label="Página inicial da Liberty">
            <Image src={logoClaro} alt="Liberty Car" className="h-auto w-28 adobe-dark:hidden" />
            <Image src={logoEscuro} alt="Liberty Car" className="hidden h-auto w-28 adobe-dark:block" />
          </Link>
          <BotaoTemaPublico />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-4xl flex-1 content-center px-5 py-12 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">Entrar</h1>
        <p className="mt-2 text-neutral-600">Escolha a área que você quer acessar.</p>
        <nav aria-label="Opções de acesso" className="mt-7 grid gap-4 sm:grid-cols-2">
          {opcoes.map(({ titulo, descricao, href, Icone }) => (
            <Link key={titulo} href={href} className="group flex min-w-0 items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-liberty focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-liberty">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-liberty/10 text-liberty-deep adobe-dark:text-adobe-accent-soft">
                <Icone aria-hidden size={23} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-neutral-900">{titulo}</h2>
                <p className="mt-1 text-sm text-neutral-600">{descricao}</p>
              </div>
              <IconArrowRight aria-hidden size={19} className="shrink-0 text-liberty-deep adobe-dark:text-adobe-accent-soft" />
            </Link>
          ))}
        </nav>
      </main>
    </div>
  )
}
