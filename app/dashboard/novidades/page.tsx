import { IconSparkles } from '@tabler/icons-react'
import { Breadcrumb, EmptyState } from '@/app/components/ui'
import { NovidadesLista } from './NovidadesLista'
import { CHANGELOG } from '@/constants/changelog'

export const metadata = {
  title: 'Novidades | Liberty Car',
  description: 'O que mudou no sistema a cada atualização.',
}

export default function NovidadesPage() {
  return (
    <div className="space-y-5 pb-10 md:space-y-6">
      <header>
        <div className="hidden md:block">
          <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Novidades' }]} />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-950 md:mt-1 md:text-3xl">
          Novidades
        </h1>
        <p className="mt-0.5 text-xs text-neutral-500 md:mt-1 md:text-sm">
          O que mudou no sistema a cada atualização.
        </p>
      </header>

      {CHANGELOG.length === 0 ? (
        <EmptyState
          icon={<IconSparkles size={24} stroke={1.5} />}
          title="Nenhuma novidade registrada ainda"
          description="As atualizações do sistema vão aparecer aqui."
        />
      ) : (
        <NovidadesLista entries={CHANGELOG} />
      )}
    </div>
  )
}
