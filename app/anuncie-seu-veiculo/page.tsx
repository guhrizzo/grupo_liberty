import type { Metadata } from 'next'
import { IconSpeakerphone, IconShieldCheck, IconClockHour4, IconCoin } from '@tabler/icons-react'
import { getSessionUser } from '@/utils/permissions'
import PublicHeader from '@/app/components/PublicHeader'
import AnuncioForm from './AnuncioForm'

export const metadata: Metadata = {
  title: 'Anuncie seu veículo | Liberty Car',
  description:
    'Cadastre o seu veículo para a Liberty Car avaliar. Envie fotos e informações — nossa equipe entra em contato.',
}

const BENEFICIOS = [
  { icon: IconShieldCheck, texto: 'Avaliação feita por quem entende do mercado da região' },
  { icon: IconClockHour4, texto: 'Retorno rápido da equipe pelo seu contato' },
  { icon: IconCoin, texto: 'Sem custo para anunciar e sem compromisso' },
]

export default async function AnuncieSeuVeiculoPage() {
  const session = await getSessionUser()
  const user = session ? { email: session.email } : null

  return (
    <div className="flex flex-col">
      <PublicHeader user={user} variant="inner" />

      <main className="flex-1 px-4 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-liberty/30 bg-liberty/5 px-3.5 py-1 text-xs font-extrabold uppercase tracking-[0.2em] text-liberty-deep">
              <IconSpeakerphone size={13} />
              Anuncie seu veículo
            </span>
            <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-neutral-900">
              Quer vender seu carro?
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm md:text-base text-neutral-600 leading-relaxed">
              Preencha os dados abaixo e envie fotos do veículo. A equipe da
              Liberty Car avalia e entra em contato com você.
            </p>
          </div>

          <ul className="mb-8 grid gap-3 sm:grid-cols-3">
            {BENEFICIOS.map(({ icon: Icon, texto }) => (
              <li
                key={texto}
                className="flex items-start gap-2.5 rounded-xl border border-neutral-200 bg-white p-3.5 text-xs text-neutral-600"
              >
                <Icon size={18} className="shrink-0 text-liberty" />
                {texto}
              </li>
            ))}
          </ul>

          <AnuncioForm />
        </div>
      </main>
    </div>
  )
}
